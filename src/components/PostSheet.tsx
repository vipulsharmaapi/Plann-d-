import Sheet from './Sheet'
import VenuePicker from './VenuePicker'
import { formatTimeRange } from '../lib/time'
import { safeExternalUrl } from '../lib/venues'
import { useEffect, useRef, useState } from 'react'
import { ArrowRight, CircleHelp, MapPin, X } from 'lucide-react'
import VenuePinMap from './VenuePinMap'
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
async function searchVenuesGoogle(q: string, signal: AbortSignal): Promise<VenueResult[]> {
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    signal,
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
  const [activity, setActivity] = useState<ActivityKey>('coffee')
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
  const [pickerOpen, setPickerOpen] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const pickerButton = useRef<HTMLButtonElement>(null)
  const draftScroll = useRef(0)
  const [errorField, setErrorField] = useState('')
  const submitting = useRef(false)
  function openPicker() {
    draftScroll.current = formRef.current?.closest('dialog')?.scrollTop ?? 0
    history.pushState({ ...history.state, planndVenuePicker: true }, '', location.href)
    setPickerOpen(true)
  }
  function closePicker() {
    if (history.state?.planndVenuePicker) history.back()
    else setPickerOpen(false)
  }
  useEffect(() => {
    if (!pickerOpen) return
    const form = formRef.current
    const opener = pickerButton.current
    const back = () => setPickerOpen(false)
    window.addEventListener('popstate', back)
    return () => {
      window.removeEventListener('popstate', back)
      requestAnimationFrame(() => {
        const dialog = form?.closest('dialog')
        if (dialog) dialog.scrollTop = draftScroll.current
        opener?.focus({ preventScroll: true })
      })
    }
  }, [pickerOpen])
  useEffect(() => {
    if (!error || !errorField) return
    const input = formRef.current?.elements.namedItem(errorField) as HTMLElement | null
    const details = input?.closest('details')
    if (details) details.open = true
    input?.setAttribute('aria-invalid', 'true')
    input?.setAttribute('aria-describedby', 'post-error')
    input?.focus()
    return () => {
      input?.removeAttribute('aria-invalid')
      input?.removeAttribute('aria-describedby')
    }
  }, [error, errorField])
  function invalid(field: string, message: string) {
    setErrorField(field)
    setError(message)
  }

  const [venueQuery, setVenueQuery] = useState('')
  const [venueResults, setVenueResults] = useState<VenueResult[]>([])
  const [searching, setSearching] = useState(false)
  const [venueError, setVenueError] = useState(false)
  const [searchAttempt, setSearchAttempt] = useState(0)
  const [showPinMap, setShowPinMap] = useState(false)

  // Debounced venue search
  useEffect(() => {
    if (!open || venueQuery.trim().length < 3) {
      setVenueResults([])
      setSearching(false)
      return
    }
    let active = true
    const controller = new AbortController()
    setSearching(true)
    setVenueError(false)
    setVenueResults([])
    const timeout = setTimeout(() => controller.abort(), 12000)
    const timer = setTimeout(() => {
      searchVenuesGoogle(venueQuery.trim(), controller.signal)
        .then((r) => {
          if (active) setVenueResults(r)
        })
        .catch(() => {
          if (active) setVenueError(true)
        })
        .finally(() => {
          clearTimeout(timeout)
          if (active) setSearching(false)
        })
    }, 400)
    return () => {
      active = false
      clearTimeout(timer)
      clearTimeout(timeout)
      controller.abort()
    }
  }, [open, venueQuery, searchAttempt])

  const chooseVenue = (v: VenueResult) => {
    setGooglePlaceId(v.placeId ?? null)
    setMenuUrl('')
    setPin({ lat: v.lat, lng: v.lng })
    setVenueName(v.name.slice(0, 80))
    setVenueQuery('')
    setVenueResults([])
    setVenueError(false)
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
      setActivity(template?.activity ?? venuePrefill?.activity ?? 'coffee')
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
      setPin(
        venue && venue.lat !== undefined && venue.lng !== undefined
          ? { lat: venue.lat, lng: venue.lng }
          : null,
      )
    }
    const details = editing ?? template
    setVenueArea(details?.venueArea ?? venuePrefill?.venueArea ?? '')
    setExpectedCost(details?.expectedCost == null ? '' : String(details.expectedCost))
    setSkillLevel(details?.skillLevel ?? '')
    setBookingStatus(editing?.bookingStatus ?? '')
    setMeetingInstructions(details?.meetingInstructions ?? '')
    setError(null)
    setVenueQuery('')
    setVenueResults([])
    setVenueError(false)
    setShowPinMap(false)
    return () => {
      active = false
    }
  }, [open, editing, template, venuePrefill])

  if (!open) return null

  const submit = async () => {
    if (!session || submitting.current || busy || linkLoading) return
    setError(null)
    setErrorField('')
    if (title.trim().length < 3) return invalid('title', 'Give it a short title (3+ characters).')
    if (!pin)
      return invalid(
        'venue',
        'Choose a venue from the search results, or pin the meeting place on Google Maps.',
      )
    if (venueArea.trim() && venueArea.trim().length < 2)
      return invalid('area', 'Use at least 2 characters for the neighbourhood.')
    if (
      expectedCost !== '' &&
      (!Number.isFinite(Number(expectedCost)) ||
        Number(expectedCost) < 0 ||
        Number(expectedCost) > 100000)
    )
      return invalid('cost', 'Enter an expected cost between ₹0 and ₹1,00,000.')
    if (!venueName.trim()) return invalid('venue', 'Name the venue so people know where to go.')
    if (endTime <= startTime) return invalid('end', 'End time must be after start time.')
    if (date < todayIST() || date > maxDateIST())
      return invalid('date', 'Pick a date between today and a week from now.')
    if (new Date(toIsoIST(date, endTime)).getTime() <= Date.now())
      return invalid('end', 'Choose a later time.')
    const link = whatsapp.trim()
    if (link && !WHATSAPP_LINK_RE.test(link))
      return invalid('whatsapp', 'Group link must look like https://chat.whatsapp.com/…')

    if (menuUrl.trim() && !safeExternalUrl(menuUrl.trim()))
      return invalid('menu', 'Use a complete https:// link for the venue menu.')
    submitting.current = true
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
      submitting.current = false
      setBusy(false)
    }
    onPosted()
  }

  const neighbourhoods = [
    'Vaishali Nagar',
    'Mansarovar',
    'C-Scheme',
    'Malviya Nagar',
    'Civil Lines',
    'Pink City',
  ]
  const hasResults = venueQuery.trim().length >= 3
  return (
    <Sheet
      title={pickerOpen ? 'Choose a venue' : editing ? 'Edit your plan' : 'Make a plan in Jaipur'}
      onClose={pickerOpen ? closePicker : onClose}
      className={`dialog wide post-dialog ${pickerOpen ? 'picker-dialog' : ''}`}
    >
      {pickerOpen && (
        <VenuePicker
          activity={activity}
          currentId={googlePlaceId}
          currentName={venueName}
          area={venueArea}
          onCancel={closePicker}
          onConfirm={(venue) => {
            setVenueName(venue.venueName)
            setVenueArea(venue.venueArea ?? '')
            setGooglePlaceId(venue.googlePlaceId)
            setPin(
              venue.lat !== undefined && venue.lng !== undefined
                ? { lat: venue.lat, lng: venue.lng }
                : null,
            )
            setMenuUrl('')
            setVenueQuery('')
            setShowPinMap(false)
            setError(null)
            closePicker()
          }}
        />
      )}
      <div hidden={pickerOpen}>
        <div className="dialog-head">
          <h2>{editing ? 'Edit your plan' : 'Make a plan in Jaipur'}</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close dialog">
            <X size={22} />
          </button>
        </div>
        <p className="dialog-intro">A place you like. Something to do. A few people to join you.</p>
        <form
          className="post-form"
          ref={formRef}
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
        >
          <label>
            What’s the plan?
            <input
              name="title"
              required
              maxLength={70}
              placeholder="Coffee and a little conversation"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <div className="form-pair">
            <label>
              Activity
              <select
                name="category"
                value={activity}
                onChange={(e) => setActivity(e.target.value as ActivityKey)}
              >
                {[...ACTIVITIES]
                  .sort((a, b) => Number(b.key === 'coffee') - Number(a.key === 'coffee'))
                  .map((a) => (
                    <option key={a.key} value={a.key}>
                      {a.label}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Open spots
              <select name="spots" value={spots} onChange={(e) => setSpots(Number(e.target.value))}>
                {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="post-venue">
            <label>
              Venue
              <input
                name="venue"
                required
                maxLength={80}
                autoComplete="off"
                placeholder="Name a café, court, park or public place"
                value={venueName}
                aria-describedby={pin ? 'venue-selected' : undefined}
                onChange={(e) => {
                  setVenueName(e.target.value)
                  setVenueQuery(e.target.value)
                  setPin(null)
                  setGooglePlaceId(null)
                  setMenuUrl('')
                }}
              />
            </label>
            {hasResults && (
              <div className="venue-suggestions" aria-label="Venue search results">
                {searching && <p role="status">Searching Google Maps…</p>}
                {!searching && venueError && (
                  <div role="alert">
                    <p>Venue search couldn’t load.</p>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => setSearchAttempt((n) => n + 1)}
                    >
                      Try again
                    </button>
                  </div>
                )}
                {venueResults.map((v) => (
                  <button
                    type="button"
                    key={v.placeId ?? `${v.lat},${v.lng}`}
                    onClick={() => chooseVenue(v)}
                  >
                    <strong>{v.name}</strong>
                    <span>{v.label}</span>
                  </button>
                ))}
                {!searching && !venueError && venueResults.length === 0 && (
                  <p>No matches. Try another name or pin the place below.</p>
                )}
                {venueResults.length > 0 && <p className="google-attribution">Google Maps</p>}
              </div>
            )}
            <div className="post-venue-discovery">
              {googlePlaceId ? (
                <div id="venue-selected">
                  <strong>{venueName}</strong>
                  <p>{venueArea || 'Jaipur'} · Google Maps</p>
                </div>
              ) : (
                <p>Not sure where to go?</p>
              )}
              <button ref={pickerButton} type="button" className="text-button" onClick={openPicker}>
                <MapPin size={18} />
                {googlePlaceId ? 'Change venue' : 'Explore Jaipur venues'}
              </button>
            </div>
            {pin && !googlePlaceId && (
              <p id="venue-selected" className="venue-selected">
                <MapPin size={14} />
                Meeting pin selected
              </p>
            )}
            {((venueName.trim().length >= 3 && !searching) || pin) && (
              <button
                type="button"
                className="text-button pin-toggle"
                aria-expanded={showPinMap}
                onClick={() => setShowPinMap((v) => !v)}
              >
                {showPinMap
                  ? 'Hide map'
                  : pin
                    ? 'Check meeting pin'
                    : 'Choose meeting pin on Google Maps'}
              </button>
            )}
            {showPinMap && (
              <VenuePinMap
                value={pin}
                onChange={(p) => {
                  setPin(p)
                  setGooglePlaceId(null)
                  setMenuUrl('')
                  setVenueQuery('')
                }}
              />
            )}
          </div>
          <div className="form-pair">
            <label>
              Jaipur neighbourhood
              <select name="area" value={venueArea} onChange={(e) => setVenueArea(e.target.value)}>
                <option value="">Choose an area</option>
                {venueArea && !neighbourhoods.includes(venueArea) && <option>{venueArea}</option>}
                {neighbourhoods.map((a) => (
                  <option key={a}>{a}</option>
                ))}
                <option value="Other area in Jaipur">Other area in Jaipur</option>
              </select>
            </label>
            <label>
              Date
              <input
                type="date"
                name="date"
                required
                min={todayIST()}
                max={maxDateIST()}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
          </div>
          <div className="form-pair">
            <label>
              Starts at
              <input
                type="time"
                name="start"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                aria-describedby="plan-time-preview"
              />
            </label>
            <label>
              Ends at
              <input
                type="time"
                name="end"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                aria-describedby="plan-time-preview"
              />
            </label>
          </div>
          <p id="plan-time-preview" className="post-time-preview">
            {startTime && endTime ? formatTimeRange(startTime, endTime) : 'Choose times in IST.'}
          </p>
          <label>
            A little about your plan
            <textarea
              name="note"
              rows={3}
              maxLength={280}
              placeholder="What will you do? Anything people should bring or know?"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <details className="post-options">
            <summary>
              More details <span>Optional</span>
            </summary>
            <div className="post-form">
              <div className="form-pair">
                <label>
                  Expected cost per person (₹)
                  <input
                    type="number"
                    name="cost"
                    min="0"
                    max="100000"
                    step="0.01"
                    inputMode="decimal"
                    value={expectedCost}
                    onChange={(e) => setExpectedCost(e.target.value)}
                    placeholder="Undecided"
                  />
                </label>
                <label>
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
              <label>
                Venue booking
                <select value={bookingStatus} onChange={(e) => setBookingStatus(e.target.value)}>
                  <option value="">Not specified</option>
                  <option value="not_needed">No booking needed</option>
                  <option value="needed">Still to be arranged</option>
                  <option value="confirmed">Booked by me</option>
                </select>
              </label>
              <label>
                Meeting point
                <textarea
                  rows={2}
                  maxLength={280}
                  value={meetingInstructions}
                  onChange={(e) => setMeetingInstructions(e.target.value)}
                  placeholder="e.g. Meet at the front desk. Bring your racket."
                />
              </label>
              <label>
                Venue menu link
                <input
                  type="url"
                  placeholder="https://…"
                  name="menu"
                  value={menuUrl}
                  maxLength={2048}
                  onChange={(e) => setMenuUrl(e.target.value)}
                />
              </label>
              <label>
                WhatsApp group link
                <input
                  type="url"
                  placeholder="https://chat.whatsapp.com/…"
                  name="whatsapp"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                />
                <small>Visible to approved members.</small>
              </label>
              <label className="post-checkbox">
                <input
                  type="checkbox"
                  checked={womenOnly}
                  onChange={(e) => setWomenOnly(e.target.checked)}
                />
                Women only (self-declared gender)
              </label>
            </div>
          </details>
          <p className="form-note">
            <CircleHelp size={17} />
            Times are in India Standard Time. Choose a public meeting place.
          </p>
          {error && (
            <p id="post-error" role="alert" className="form-error">
              {error}
            </p>
          )}
          <button className="primary" type="submit" disabled={busy || linkLoading}>
            {linkLoading
              ? 'Loading saved details…'
              : busy
                ? 'Saving…'
                : editing
                  ? 'Save changes'
                  : 'Post your plan'}
            <ArrowRight size={20} />
          </button>
        </form>
      </div>
    </Sheet>
  )
}
