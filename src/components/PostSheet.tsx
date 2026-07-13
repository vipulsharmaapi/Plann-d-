import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { ACTIVITIES, type ActivityKey, type Intent } from '../types'

interface Props {
  open: boolean
  session: Session | null
  firstName: string
  editing?: Intent | null
  onClose: () => void
  onPosted: () => void
}

const JAIPUR_CENTER: [number, number] = [75.7873, 26.8905]

interface VenueResult {
  name: string
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
      'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location',
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
  return ((json.places ?? []) as Array<{
    displayName?: { text?: string }
    formattedAddress?: string
    location: { latitude: number; longitude: number }
  }>)
    .map((p) => ({
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
    .map((f: { properties: Record<string, string>; geometry: { coordinates: [number, number] } }) => {
      const p = f.properties
      const [lng, lat] = f.geometry.coordinates
      const area = [p.district, p.city, p.state].filter(Boolean).slice(0, 2).join(', ')
      return {
        name: p.name || p.street || q,
        label: area,
        lat,
        lng,
      }
    })
    .filter(
      (v: VenueResult) =>
        Math.abs(v.lat - JAIPUR_CENTER[1]) < 0.55 && Math.abs(v.lng - JAIPUR_CENTER[0]) < 0.55,
    )
}

// Today's date in IST as yyyy-mm-dd, so "19:00" becomes 19:00 IST today.
const todayIST = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
const toIsoIST = (time: string) => new Date(`${todayIST()}T${time}:00+05:30`).toISOString()

export default function PostSheet({ open, session, firstName, editing, onClose, onPosted }: Props) {
  const [activity, setActivity] = useState<ActivityKey>('badminton')
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [startTime, setStartTime] = useState('19:00')
  const [endTime, setEndTime] = useState('21:00')
  const [spots, setSpots] = useState(2)
  const [womenOnly, setWomenOnly] = useState(false)
  const [whatsapp, setWhatsapp] = useState('')
  const [venueName, setVenueName] = useState('')
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const mapDivRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markerRef = useRef<maplibregl.Marker | null>(null)
  const [venueQuery, setVenueQuery] = useState('')
  const [venueResults, setVenueResults] = useState<VenueResult[]>([])
  const [searching, setSearching] = useState(false)

  // Debounced venue search
  useEffect(() => {
    const q = venueQuery.trim()
    if (q.length < 3) {
      setVenueResults([])
      return
    }
    setSearching(true)
    const t = setTimeout(async () => {
      try {
        setVenueResults(await searchVenues(q))
      } catch {
        setVenueResults([])
      } finally {
        setSearching(false)
      }
    }, 400)
    return () => clearTimeout(t)
  }, [venueQuery])

  const placePin = (lat: number, lng: number) => {
    setPin({ lat, lng })
    const map = mapRef.current
    if (!map) return
    if (!markerRef.current) {
      markerRef.current = new maplibregl.Marker({ color: '#111827' }).setLngLat([lng, lat]).addTo(map)
    } else {
      markerRef.current.setLngLat([lng, lat])
    }
    map.easeTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 14), duration: 500 })
  }

  const chooseVenue = (v: VenueResult) => {
    placePin(v.lat, v.lng)
    setVenueName(v.label ? `${v.name}, ${v.label.split(',')[0]}` : v.name)
    setVenueQuery('')
    setVenueResults([])
  }

  // Populate (or reset) the form each time the sheet opens
  useEffect(() => {
    if (!open) return
    if (editing) {
      setActivity(editing.activity)
      setTitle(editing.title)
      setNote(editing.note ?? '')
      setStartTime(editing.startsAt)
      setEndTime(editing.endsAt)
      setSpots(editing.spotsNeeded)
      setWomenOnly(editing.womenOnly)
      setWhatsapp(editing.whatsappLink ?? '')
      setVenueName(editing.venueName)
      setPin({ lat: editing.lat, lng: editing.lng })
    } else {
      setActivity('badminton')
      setTitle('')
      setNote('')
      setStartTime('19:00')
      setEndTime('21:00')
      setSpots(2)
      setWomenOnly(false)
      setWhatsapp('')
      setVenueName('')
      setPin(null)
    }
    setError(null)
  }, [open, editing])

  useEffect(() => {
    if (!open || !mapDivRef.current) return
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
      center: editing ? [editing.lng, editing.lat] : JAIPUR_CENTER,
      zoom: editing ? 13 : 10.8,
      attributionControl: false,
    })
    if (editing) {
      markerRef.current = new maplibregl.Marker({ color: '#111827' })
        .setLngLat([editing.lng, editing.lat])
        .addTo(map)
    }
    map.on('click', (e) => {
      setPin({ lat: e.lngLat.lat, lng: e.lngLat.lng })
      if (!markerRef.current) {
        markerRef.current = new maplibregl.Marker({ color: '#111827' })
          .setLngLat(e.lngLat)
          .addTo(map)
      } else {
        markerRef.current.setLngLat(e.lngLat)
      }
    })
    mapRef.current = map
    return () => {
      markerRef.current = null
      mapRef.current = null
      map.remove()
    }
  }, [open, editing])

  if (!open) return null

  const submit = async () => {
    if (!session) return
    setError(null)
    if (title.trim().length < 3) return setError('Give it a short title (3+ characters).')
    if (!pin) return setError('Tap the map to drop a pin where you’ll meet.')
    if (!venueName.trim()) return setError('Name the venue so people know where to go.')
    if (endTime <= startTime) return setError('End time must be after start time.')

    setBusy(true)
    const values = {
      activity,
      title: title.trim(),
      note: note.trim() || null,
      lat: pin.lat,
      lng: pin.lng,
      venue_name: venueName.trim(),
      starts_at: toIsoIST(startTime),
      ends_at: toIsoIST(endTime),
      spots_needed: spots,
      women_only: womenOnly,
      whatsapp_link: whatsapp.trim() || null,
    }
    const { error: err } = editing
      ? await supabase.from('intents').update(values).eq('id', editing.id)
      : await supabase.from('intents').insert({
          ...values,
          user_id: session.user.id,
          poster_name: firstName || 'Someone',
        })
    setBusy(false)
    if (err) {
      setError(err.message)
      return
    }
    onPosted()
  }

  const inputCls =
    'w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-gray-900'

  return (
    <div className="absolute inset-0 z-30 flex items-end sm:items-center sm:justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl max-h-[92%] overflow-y-auto p-5 pb-8 space-y-4">
        <div className="w-10 h-1 rounded-full bg-gray-300 mx-auto sm:hidden" />
        <h2 className="text-lg font-bold text-gray-900">
          {editing ? 'Edit your post' : 'Post an activity'}
        </h2>

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

        <input
          className={inputCls}
          placeholder="Title — e.g. Badminton doubles, need 2"
          value={title}
          maxLength={80}
          onChange={(e) => setTitle(e.target.value)}
        />

        <div className="flex items-center gap-3">
          <label className="flex-1 text-sm text-gray-600">
            From
            <input
              type="time"
              className={`${inputCls} mt-1`}
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </label>
          <label className="flex-1 text-sm text-gray-600">
            Till
            <input
              type="time"
              className={`${inputCls} mt-1`}
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </label>
          <label className="w-24 text-sm text-gray-600">
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
          <p className="text-sm text-gray-600 mb-1.5">
            Where? <span className="text-gray-400">Search a venue or tap the map</span>
          </p>
          <div className="relative mb-2">
            <input
              className={inputCls}
              placeholder="🔍 Search venue — e.g. Central Park"
              value={venueQuery}
              onChange={(e) => setVenueQuery(e.target.value)}
            />
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
                    No matches near Jaipur — tap the map instead.
                  </p>
                )}
              </div>
            )}
          </div>
          <div ref={mapDivRef} className="h-44 rounded-xl overflow-hidden border border-gray-200" />
        </div>

        <input
          className={inputCls}
          placeholder="Venue name — e.g. Central Park, C-Scheme"
          value={venueName}
          maxLength={80}
          onChange={(e) => setVenueName(e.target.value)}
        />

        <input
          className={inputCls}
          placeholder="Note (optional) — skill level, cost split…"
          value={note}
          maxLength={280}
          onChange={(e) => setNote(e.target.value)}
        />

        <input
          className={inputCls}
          placeholder="WhatsApp group link (optional)"
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
        />

        <label className="flex items-center gap-2.5 text-sm font-medium text-gray-700">
          <input
            type="checkbox"
            className="w-4 h-4 accent-pink-600"
            checked={womenOnly}
            onChange={(e) => setWomenOnly(e.target.checked)}
          />
          Women only
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          onClick={submit}
          disabled={busy}
          className="w-full bg-gray-900 text-white rounded-xl py-3 font-semibold disabled:opacity-40"
        >
          {busy ? 'Saving…' : editing ? 'Save changes' : 'Post it 🙌'}
        </button>
      </div>
    </div>
  )
}
