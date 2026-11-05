import Sheet from './Sheet'
import { formatTimeRange } from '../lib/time'
import { safeExternalUrl } from '../lib/venues'
import { useEffect, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { GOOGLE_MAP_ID, loadGoogleMaps, onGoogleAuthFailure } from '../lib/googleMaps'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { ACTIVITIES, type ActivityKey, type Intent, type VenueDraft } from '../types'

interface Props {
  open: boolean
  session: Session | null
  firstName: string
  editing?: Intent | null
  /** Prefill from a past post but create a new one ("post again") */
  template?: Intent | null
  venuePrefill?: VenueDraft | null
  onClose: () => void
  onPosted: () => void
}

const JAIPUR_CENTER: [number, number] = [75.7873, 26.8905]

// Only real WhatsApp URLs — blocks javascript: and lookalike links
const WHATSAPP_LINK_RE = /^https:\/\/(chat\.whatsapp\.com|wa\.me)\/[A-Za-z0-9?=&+_-]+$/

interface VenueResult {
  name: string
  placeId?: string
  label: string
  lat: number
  lng: number
}

const GOOGLE_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined

const nearJaipur = (v: VenueResult) =>
  Math.abs(v.lat - JAIPUR_CENTER[1]) < 0.55 && Math.abs(v.lng - JAIPUR_CENTER[0]) < 0.55

// Google Places (New) Text Search — much better coverage of Indian venues.
// Used automatically when VITE_GOOGLE_MAPS_API_KEY is set.
async function searchVenuesGoogle(q: string): Promise<VenueResult[]> {
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_KEY!,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location',
    },
    body: JSON.stringify({
      textQuery: `${q}, Jaipur`,
      locationBias: {
        circle: {
          center: { latitude: JAIPUR_CENTER[1], longitude: JAIPUR_CENTER[0] },
          radius: 50000,
        },
      },
      pageSize: 6,
    }),
  })
  if (!res.ok) throw new Error(`places ${res.status}`)
  const json = await res.json()
  return (
    (json.places ?? []) as Array<{
      id: string
      displayName?: { text?: string }
      formattedAddress?: string
      location: { latitude: number; longitude: number }
    }>
  )
    .map((p) => ({
      placeId: p.id,
      name: p.displayName?.text || q,
      label: (p.formattedAddress ?? '').split(',').slice(0, 2).join(',').trim(),
      lat: p.location.latitude,
      lng: p.location.longitude,
    }))
    .filter(nearJaipur)
}

// Free OpenStreetMap geocoder (photon.komoot.io), biased to Jaipur and
// filtered to ~60 km around it.
async function searchVenues(q: string): Promise<VenueResult[]> {
  if (GOOGLE_KEY) {
    try {
      return await searchVenuesGoogle(q)
    } catch {
      // fall through to the free geocoder on quota/config errors
    }
  }
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&lat=${JAIPUR_CENTER[1]}&lon=${JAIPUR_CENTER[0]}&limit=6`
  const res = await fetch(url)
  if (!res.ok) return []
  const json = await res.json()
  return (json.features ?? [])
    .map(
      (f: { properties: Record<string, string>; geometry: { coordinates: [number, number] } }) => {
        const p = f.properties
        const [lng, lat] = f.geometry.coordinates
        const area = [p.district, p.city, p.state].filter(Boolean).slice(0, 2).join(', ')
        return {
          name: p.name || p.street || q,
          label: area,
          lat,
          lng,
        }
      },
    )
    .filter(
      (v: VenueResult) =>
        Math.abs(v.lat - JAIPUR_CENTER[1]) < 0.55 && Math.abs(v.lng - JAIPUR_CENTER[0]) < 0.55,
    )
}

// Today's date in IST as yyyy-mm-dd, so "19:00" becomes 19:00 IST today.
const todayIST = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
const toIsoIST = (date: string, time: string) => new Date(`${date}T${time}:00+05:30`).toISOString()
// Posting horizon: up to a week ahead keeps the map about near-term plans
const maxDateIST = () =>
  new Date(Date.now() + 7 * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })

// Default window: next half-hour for 2 hours, clamped to today (IST)
const defaultTimes = () => {
  const [h, m] = new Date()
    .toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })
    .split(':')
    .map(Number)
  let sh = h
  let sm: number
  if (m < 30) {
    sm = 30
  } else {
    sh += 1
    sm = 0
  }
  if (sh >= 23) return { start: '23:00', end: '23:59' }
  const pad = (n: number) => String(n).padStart(2, '0')
  const eh = Math.min(sh + 2, 23)
  return {
    start: `${pad(sh)}:${pad(sm)}`,
    end: eh === 23 ? '23:59' : `${pad(eh)}:${pad(sm)}`,
  }
}

export default function PostSheet({
  open,
  session,
  editing,
  template,
  venuePrefill,
  onClose,
  onPosted,
}: Props) {
  const [activity, setActivity] = useState<ActivityKey>('badminton')
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(todayIST())
  const [startTime, setStartTime] = useState('19:00')
  const [endTime, setEndTime] = useState('21:00')
  const [spots, setSpots] = useState(2)
  const [womenOnly, setWomenOnly] = useState(false)
  const [whatsapp, setWhatsapp] = useState('')
  const [venueName, setVenueName] = useState('')
  const [venueArea, setVenueArea] = useState('')
  const [expectedCost, setExpectedCost] = useState('')
  const [skillLevel, setSkillLevel] = useState('')
  const [bookingStatus, setBookingStatus] = useState('')
  const [meetingInstructions, setMeetingInstructions] = useState('')
  const [googlePlaceId, setGooglePlaceId] = useState<string | null>(null)
  const [menuUrl, setMenuUrl] = useState('')
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [linkLoading, setLinkLoading] = useState(false)
  const draftId = useRef<string>(crypto.randomUUID())

  const mapDivRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markerRef = useRef<maplibregl.Marker | null>(null)
  const gMapRef = useRef<google.maps.Map | null>(null)
  const gMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null)
  const [venueQuery, setVenueQuery] = useState('')
  const [venueResults, setVenueResults] = useState<VenueResult[]>([])
  const [searching, setSearching] = useState(false)

  // Debounced venue search
  useEffect(() => {
    const q = venueQuery.trim()
    if (q.length < 3) {
      setSearching(false)
      setVenueResults([])
      return
    }
    let active = true
    setSearching(true)
    const t = setTimeout(async () => {
      try {
        const results = await searchVenues(q)
        if (active) setVenueResults(results)
      } catch {
        if (active) setVenueResults([])
      } finally {
        if (active) setSearching(false)
      }
    }, 400)
    return () => {
      active = false
      clearTimeout(t)
    }
  }, [venueQuery])

  const placePin = (lat: number, lng: number) => {
    setPin({ lat, lng })
    const gMap = gMapRef.current
    if (gMap) {
      if (!gMarkerRef.current) {
        gMarkerRef.current = new google.maps.marker.AdvancedMarkerElement({
          map: gMap,
          position: { lat, lng },
        })
      } else {
        gMarkerRef.current.position = { lat, lng }
      }
      gMap.panTo({ lat, lng })
      if ((gMap.getZoom() ?? 0) < 14) gMap.setZoom(14)
      return
    }
    const map = mapRef.current
    if (!map) return
    if (!markerRef.current) {
      markerRef.current = new maplibregl.Marker({ color: '#8b362a' })
        .setLngLat([lng, lat])
        .addTo(map)
    } else {
      markerRef.current.setLngLat([lng, lat])
    }
    map.easeTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 14), duration: 500 })
  }

  const chooseVenue = (v: VenueResult) => {
    setGooglePlaceId(v.placeId ?? null)
    setMenuUrl('')
    setVenueArea('')
    placePin(v.lat, v.lng)
    setVenueName(v.label ? `${v.name}, ${v.label.split(',')[0]}` : v.name)
    setVenueQuery('')
    setVenueResults([])
  }

  // Populate (or reset) the form each time the sheet opens
  useEffect(() => {
    if (!open) return
    let active = true
    draftId.current = editing?.id ?? crypto.randomUUID()
    if (editing) {
      setActivity(editing.activity)
      setTitle(editing.title)
      setNote(editing.note ?? '')
      setDate(editing.date)
      setStartTime(editing.startsAt)
      setEndTime(editing.endsAt)
      setSpots(editing.spotsNeeded)
      setWomenOnly(editing.womenOnly)
      setWhatsapp('')
      setLinkLoading(true)
      setVenueName(editing.venueName)
      setGooglePlaceId(editing.googlePlaceId ?? null)
      setMenuUrl(editing.venueMenuUrl ?? '')
      setPin({ lat: editing.lat, lng: editing.lng })
      // Group link lives in a participant-only table
      supabase
        .from('intent_links')
        .select('whatsapp_link')
        .eq('intent_id', editing.id)
        .maybeSingle()
        .then(({ data, error }) => {
          if (active) {
            setLinkLoading(false)
            if (error) {
              setError('Could not load the saved group link. Reopen this editor before saving.')
              setLinkLoading(true)
            } else setWhatsapp(data?.whatsapp_link ?? '')
          }
        })
    } else {
      setLinkLoading(false)
      const t = defaultTimes()
      setActivity(template?.activity ?? venuePrefill?.activity ?? 'badminton')
      setTitle(template?.title ?? '')
      setNote(template?.note ?? '')
      setDate(todayIST())
      setStartTime(t.start)
      setEndTime(t.end)
      setSpots(template?.spotsNeeded ?? 2)
      setWomenOnly(template?.womenOnly ?? false)
      setWhatsapp('')
      setVenueName(template?.venueName ?? venuePrefill?.venueName ?? '')
      setGooglePlaceId(template?.googlePlaceId ?? venuePrefill?.googlePlaceId ?? null)
      setMenuUrl(template?.venueMenuUrl ?? '')
      const venue = template ?? venuePrefill
      setPin(venue ? { lat: venue.lat, lng: venue.lng } : null)
    }
    const details = editing ?? template
    setVenueArea(details?.venueArea ?? venuePrefill?.venueArea ?? '')
    setExpectedCost(details?.expectedCost == null ? '' : String(details.expectedCost))
    setSkillLevel(details?.skillLevel ?? '')
    setBookingStatus(editing?.bookingStatus ?? '')
    setMeetingInstructions(details?.meetingInstructions ?? '')
    setError(null)
    return () => {
      active = false
    }
  }, [open, editing, template, venuePrefill])

  useEffect(() => {
    if (!open || !mapDivRef.current) return
    let cancelled = false
    let mlMap: maplibregl.Map | null = null
    const prefill = editing ?? template ?? venuePrefill ?? null

    const initMapLibre = () => {
      if (cancelled || !mapDivRef.current) return
      const map = new maplibregl.Map({
        container: mapDivRef.current,
        style: {
          version: 8,
          sources: {
            osm: {
              type: 'raster',
              tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
              tileSize: 256,
              attribution: '© OpenStreetMap contributors',
            },
          },
          layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
        },
        center: prefill ? [prefill.lng, prefill.lat] : JAIPUR_CENTER,
        zoom: prefill ? 13 : 10.8,
        attributionControl: { compact: true },
      })
      if (prefill) {
        markerRef.current = new maplibregl.Marker({ color: '#8b362a' })
          .setLngLat([prefill.lng, prefill.lat])
          .addTo(map)
      }
      map.on('click', (e) => {
        setGooglePlaceId(null)
        setMenuUrl('')
        setPin({ lat: e.lngLat.lat, lng: e.lngLat.lng })
        if (!markerRef.current) {
          markerRef.current = new maplibregl.Marker({ color: '#8b362a' })
            .setLngLat(e.lngLat)
            .addTo(map)
        } else {
          markerRef.current.setLngLat(e.lngLat)
        }
      })
      mapRef.current = map
      mlMap = map
    }

    const offAuthFailure = onGoogleAuthFailure(() => {
      if (cancelled || !mapDivRef.current) return
      // Google map got created but its auth failed — wipe it, use OSM
      gMapRef.current = null
      gMarkerRef.current = null
      mapDivRef.current.innerHTML = ''
      initMapLibre()
    })

    loadGoogleMaps()
      .then((g) => {
        if (cancelled || !mapDivRef.current) return
        const map = new g.maps.Map(mapDivRef.current, {
          center: prefill
            ? { lat: prefill.lat, lng: prefill.lng }
            : { lat: JAIPUR_CENTER[1], lng: JAIPUR_CENTER[0] },
          zoom: prefill ? 13 : 10.8,
          mapId: GOOGLE_MAP_ID,
          disableDefaultUI: true,
          zoomControl: true,
          clickableIcons: false,
        })
        gMapRef.current = map
        if (prefill) {
          gMarkerRef.current = new g.maps.marker.AdvancedMarkerElement({
            map,
            position: { lat: prefill.lat, lng: prefill.lng },
          })
        }
        map.addListener('click', (e: google.maps.MapMouseEvent) => {
          setGooglePlaceId(null)
          setMenuUrl('')
          if (!e.latLng) return
          const lat = e.latLng.lat()
          const lng = e.latLng.lng()
          setPin({ lat, lng })
          if (!gMarkerRef.current) {
            gMarkerRef.current = new g.maps.marker.AdvancedMarkerElement({
              map,
              position: { lat, lng },
            })
          } else {
            gMarkerRef.current.position = { lat, lng }
          }
        })
      })
      .catch(initMapLibre)

    return () => {
      cancelled = true
      offAuthFailure()
      markerRef.current = null
      mapRef.current = null
      if (gMarkerRef.current) gMarkerRef.current.map = null
      gMarkerRef.current = null
      gMapRef.current = null
      mlMap?.remove()
    }
  }, [open, editing, template, venuePrefill])

  if (!open) return null

  const submit = async () => {
    if (!session || busy || linkLoading) return
    setError(null)
    if (title.trim().length < 3) return setError('Give it a short title (3+ characters).')
    if (!pin) return setError('Tap the map to drop a pin where you’ll meet.')
    if (venueArea.trim() && venueArea.trim().length < 2)
      return setError('Use at least 2 characters for the neighbourhood.')
    if (
      expectedCost !== '' &&
      (!Number.isFinite(Number(expectedCost)) ||
        Number(expectedCost) < 0 ||
        Number(expectedCost) > 100000)
    )
      return setError('Enter an expected cost between ₹0 and ₹1,00,000.')
    if (!venueName.trim()) return setError('Name the venue so people know where to go.')
    if (endTime <= startTime) return setError('End time must be after start time.')
    if (date < todayIST() || date > maxDateIST())
      return setError('Pick a date between today and a week from now.')
    if (new Date(toIsoIST(date, endTime)).getTime() <= Date.now())
      return setError('Choose a later time.')
    const link = whatsapp.trim()
    if (link && !WHATSAPP_LINK_RE.test(link))
      return setError('Group link must look like https://chat.whatsapp.com/…')

    if (menuUrl.trim() && !safeExternalUrl(menuUrl.trim()))
      return setError('Use a complete https:// link for the venue menu.')
    setBusy(true)
    const values = {
      activity,
      title: title.trim(),
      note: note.trim() || null,
      lat: pin.lat,
      lng: pin.lng,
      venue_name: venueName.trim(),
      venue_area: venueArea.trim() || null,
      expected_cost: expectedCost === '' ? null : Number(expectedCost),
      skill_level: skillLevel || null,
      booking_status: bookingStatus || null,
      meeting_instructions: meetingInstructions.trim() || null,
      google_place_id: googlePlaceId,
      venue_menu_url: menuUrl.trim() || null,
      starts_at: toIsoIST(date, startTime),
      ends_at: toIsoIST(date, endTime),
      spots_needed: spots,
      women_only: womenOnly,
    }
    try {
      const { error: err } = await supabase.rpc('save_plan', {
        p_id: draftId.current,
        p_plan: values,
        p_whatsapp_link: link || null,
      })
      if (err) {
        setError(err.message)
        return
      }
    } catch {
      setError('Could not save your plan. Your draft is still here; try again.')
      return
    } finally {
      setBusy(false)
    }
    onPosted()
  }

  const inputCls =
    'w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-gray-900'

  return (
    <Sheet title="Plan editor" onClose={onClose}>
      <div className="sheet-panel relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl max-h-[92%] overflow-y-auto p-5 pb-8 space-y-4">
        <div className="w-10 h-1 rounded-full bg-gray-300 mx-auto sm:hidden" />
        <h2 className="text-lg font-bold text-gray-900">
          {editing ? 'Edit your post' : 'Post an activity'}
        </h2>
        {venuePrefill && !editing && !template && (
          <p className="text-sm text-gray-600">
            Venue selected. Add a title, time and group size. Posting a plan doesn’t reserve the
            venue.
          </p>
        )}

        <label className="block text-sm text-gray-600">
          What's the plan?
          <select
            className={`${inputCls} mt-1 appearance-none bg-white`}
            value={activity}
            onChange={(e) => setActivity(e.target.value as ActivityKey)}
          >
            {ACTIVITIES.map((a) => (
              <option key={a.key} value={a.key}>
                {a.emoji} {a.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          Plan title
          <input
            className={inputCls}
            placeholder="e.g. Badminton doubles, need 2"
            value={title}
            maxLength={80}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>

        <label className="block text-sm text-gray-600">
          When?
          <input
            type="date"
            className={`${inputCls} mt-1`}
            value={date}
            min={todayIST()}
            max={maxDateIST()}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>

        <div className="grid grid-cols-1 min-[380px]:grid-cols-2 sm:grid-cols-3 items-end gap-3">
          <label className="min-w-0 text-sm text-gray-600">
            From
            <input
              type="time"
              aria-describedby="plan-time-preview"
              className={`${inputCls} mt-1`}
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </label>
          <label className="min-w-0 text-sm text-gray-600">
            Till
            <input
              type="time"
              aria-describedby="plan-time-preview"
              className={`${inputCls} mt-1`}
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </label>
          <label className="min-[380px]:col-span-2 sm:col-span-1 min-w-0 text-sm text-gray-600">
            Need
            <select
              className={`${inputCls} mt-1`}
              value={spots}
              onChange={(e) => setSpots(Number(e.target.value))}
            >
              {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div>
          <p id="plan-time-preview" className="text-sm text-gray-600 mb-3">
            {startTime && endTime
              ? formatTimeRange(startTime, endTime)
              : 'Choose times in India Standard Time (IST).'}
          </p>
          <p className="text-sm text-gray-600 mb-1.5">
            Where? <span className="text-gray-400">Search a venue or tap the map</span>
          </p>
          <div className="relative mb-2">
            <label className="field">
              Search venues in Jaipur
              <input
                className={inputCls}
                placeholder="e.g. Central Park"
                value={venueQuery}
                onChange={(e) => setVenueQuery(e.target.value)}
              />
            </label>
            {(venueResults.length > 0 || searching || venueQuery.trim().length >= 3) && (
              <div className="absolute top-full inset-x-0 z-10 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                {searching && venueResults.length === 0 && (
                  <p className="px-3 py-2.5 text-sm text-gray-400">Searching…</p>
                )}
                {venueResults.map((v, i) => (
                  <button
                    key={i}
                    onClick={() => chooseVenue(v)}
                    className="w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 border-b border-gray-100 last:border-0"
                  >
                    <span className="font-medium text-gray-900">{v.name}</span>
                    {v.label && <span className="text-gray-400"> · {v.label}</span>}
                  </button>
                ))}
                {!searching && venueResults.length === 0 && venueQuery.trim().length >= 3 && (
                  <p className="px-3 py-2.5 text-sm text-gray-400">
                    No matches in Jaipur. Try the map.
                  </p>
                )}
              </div>
            )}
          </div>
          <div ref={mapDivRef} className="h-44 rounded-xl overflow-hidden border border-gray-200" />
        </div>

        <label className="field">
          Meeting venue
          <input
            className={inputCls}
            placeholder="e.g. Central Park, C-Scheme"
            value={venueName}
            maxLength={80}
            onChange={(e) => {
              setVenueName(e.target.value)
              setGooglePlaceId(null)
              setMenuUrl('')
            }}
          />
        </label>
        <label className="field">
          Neighbourhood in Jaipur (optional)
          <input
            value={venueArea}
            onChange={(e) => setVenueArea(e.target.value)}
            maxLength={100}
            placeholder="e.g. Vaishali Nagar"
          />
        </label>
        <fieldset className="border-t border-slate-200 pt-5 space-y-4">
          <legend className="font-bold text-base">Before people join</legend>
          <p className="text-sm text-gray-600">Optional. These details are public.</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="field">
              Expected cost per person (₹)
              <input
                type="number"
                min="0"
                max="100000"
                step="0.01"
                inputMode="decimal"
                value={expectedCost}
                onChange={(e) => setExpectedCost(e.target.value)}
                placeholder="Leave blank if undecided"
              />
              <span className="text-xs text-gray-600">Estimate only. Enter 0 for free.</span>
            </label>
            <label className="field">
              Skill level
              <select value={skillLevel} onChange={(e) => setSkillLevel(e.target.value)}>
                <option value="">Not specified</option>
                <option value="all">All levels welcome</option>
                <option value="beginner">Beginner friendly</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </label>
          </div>
          <label className="field">
            Venue booking
            <select value={bookingStatus} onChange={(e) => setBookingStatus(e.target.value)}>
              <option value="">Not specified</option>
              <option value="not_needed">No booking needed</option>
              <option value="needed">Still to be arranged</option>
              <option value="confirmed">Booked by me</option>
            </select>
          </label>
          <label className="field">
            Where to meet and what to expect
            <textarea
              rows={2}
              maxLength={280}
              value={meetingInstructions}
              onChange={(e) => setMeetingInstructions(e.target.value)}
              placeholder="e.g. Meet at the front desk. Bring your racket."
            />
          </label>
        </fieldset>

        <label className="field">
          Venue menu link (optional)
          <input
            type="url"
            className={inputCls}
            placeholder="https://…"
            value={menuUrl}
            maxLength={2048}
            onChange={(e) => setMenuUrl(e.target.value)}
          />
          <span className="text-xs text-gray-600">
            Link the venue’s official menu. Members will see that you added it.
          </span>
        </label>

        <label className="field">
          Note (optional)
          <input
            className={inputCls}
            placeholder="Anything else people should know?"
            value={note}
            maxLength={280}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>

        <label className="field">
          WhatsApp group link (optional)
          <input
            className={inputCls}
            placeholder="https://chat.whatsapp.com/…"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
          />
        </label>

        <label className="flex items-center gap-2.5 text-sm font-medium text-gray-700">
          <input
            type="checkbox"
            className="w-4 h-4 accent-pink-600"
            checked={womenOnly}
            onChange={(e) => setWomenOnly(e.target.checked)}
          />
          Women only (self-declared gender)
        </label>

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}

        <button
          onClick={submit}
          disabled={busy || linkLoading}
          className="w-full bg-gray-900 text-white rounded-xl py-3 font-semibold disabled:opacity-40"
        >
          {linkLoading
            ? 'Loading saved details…'
            : busy
              ? 'Saving…'
              : editing
                ? 'Save changes'
                : 'Post plan'}
        </button>
      </div>
    </Sheet>
  )
}
