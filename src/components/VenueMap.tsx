import { useEffect, useRef, useState } from 'react'
import { LocateFixed, Star, X } from 'lucide-react'
import { GOOGLE_MAP_ID, loadGoogleMaps, onGoogleAuthFailure } from '../lib/googleMaps'
import type { DiscoverableVenue } from '../lib/venues'

interface Props {
  places: DiscoverableVenue[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onPost: (place: DiscoverableVenue) => void
}
type MarkerEntry = {
  marker: google.maps.marker.AdvancedMarkerElement
  pin: HTMLDivElement
  click: () => void
}

export default function VenueMap({ places, selectedId, onSelect, onPost }: Props) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<google.maps.Map | null>(null)
  const api = useRef<typeof google | null>(null)
  const markers = useRef(new Map<string, MarkerEntry>())
  const select = useRef(onSelect)
  const currentPlaces = useRef(places)
  useEffect(() => {
    select.current = onSelect
    currentPlaces.current = places
  }, [onSelect, places])
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const selected = places.find((place) => place.id === selectedId)
  const selectedNumber = places.findIndex((place) => place.id === selectedId) + 1

  useEffect(() => {
    let active = true
    let mapClick: google.maps.MapsEventListener | undefined
    const entries = markers.current
    setReady(false)
    setFailed(false)
    function fail() {
      if (!active) return
      active = false
      clearTimeout(timeout)
      setFailed(true)
      setReady(false)
    }
    const timeout = setTimeout(fail, 12000)
    const offAuthFailure = onGoogleAuthFailure(fail)
    loadGoogleMaps()
      .then((g) => {
        if (!active || !container.current) return
        api.current = g
        map.current = new g.maps.Map(container.current, {
          center: { lat: 26.8905, lng: 75.7873 },
          zoom: 11,
          mapId: GOOGLE_MAP_ID,
          disableDefaultUI: true,
          zoomControl: true,
          clickableIcons: false,
          gestureHandling: 'cooperative',
          maxZoom: 19,
        })
        mapClick = map.current.addListener('click', () => select.current(null))
        clearTimeout(timeout)
        setReady(true)
      })
      .catch(fail)
    return () => {
      active = false
      clearTimeout(timeout)
      offAuthFailure()
      mapClick?.remove()
      for (const { marker, click } of entries.values()) {
        marker.removeEventListener('gmp-click', click)
        marker.map = null
      }
      entries.clear()
      map.current = null
      api.current = null
    }
  }, [attempt])

  function fitAll() {
    const g = api.current,
      view = map.current,
      venues = currentPlaces.current
    if (!g || !view || !venues.length) return
    const first = venues[0].location
    if (
      venues.every(
        (place) =>
          place.location.latitude === first.latitude &&
          place.location.longitude === first.longitude,
      )
    ) {
      view.setCenter({ lat: first.latitude, lng: first.longitude })
      view.setZoom(15)
      return
    }
    const bounds = new g.maps.LatLngBounds()
    for (const place of venues)
      bounds.extend({ lat: place.location.latitude, lng: place.location.longitude })
    view.fitBounds(bounds, 48)
  }

  useEffect(() => {
    const g = api.current,
      view = map.current
    if (!ready || !g || !view) return
    const ids = new Set(places.map((place) => place.id))
    for (const [id, entry] of markers.current) {
      if (!ids.has(id)) {
        entry.marker.removeEventListener('gmp-click', entry.click)
        entry.marker.map = null
        markers.current.delete(id)
      }
    }
    places.forEach((place, index) => {
      let entry = markers.current.get(place.id)
      if (!entry) {
        const pin = document.createElement('div')
        pin.className = 'venue-map-pin'
        const marker = new g.maps.marker.AdvancedMarkerElement({
          map: view,
          position: { lat: place.location.latitude, lng: place.location.longitude },
          content: pin,
          gmpClickable: true,
        })
        const click = () => select.current(place.id)
        marker.addEventListener('gmp-click', click)
        entry = { marker, pin, click }
        markers.current.set(place.id, entry)
      }
      entry.pin.textContent = String(index + 1)
      entry.marker.title = `${index + 1}. ${place.displayName.text}`
    })
    fitAll()
  }, [places, ready])

  useEffect(() => {
    if (!ready) return
    for (const [id, entry] of markers.current) {
      entry.pin.dataset.selected = String(id === selectedId)
      entry.marker.zIndex = id === selectedId ? 1000 : 1
    }
    const place = places.find((venue) => venue.id === selectedId)
    if (place && map.current) {
      map.current.panTo({ lat: place.location.latitude, lng: place.location.longitude })
    }
  }, [selectedId, places, ready])

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-x-3 px-4 py-2">
        <p className="text-sm text-slate-600">
          {places.length} {places.length === 1 ? 'venue' : 'venues'} · Select a numbered pin
        </p>
        <button
          className="text-sm font-semibold min-h-11 inline-flex items-center gap-1.5 disabled:opacity-50"
          disabled={!ready}
          onClick={() => {
            onSelect(null)
            fitAll()
          }}
        >
          <LocateFixed size={16} aria-hidden="true" />
          Fit all venues
        </button>
      </div>
      <div className={`relative h-72 sm:h-96 bg-slate-100 ${failed ? 'hidden' : ''}`}>
        <div ref={container} className="absolute inset-0" aria-label="Map of venue results" />
        {!ready && (
          <p
            role="status"
            className="absolute inset-0 grid place-items-center text-sm text-slate-600 pointer-events-none"
          >
            Loading venue map…
          </p>
        )}
      </div>
      {failed && (
        <div role="alert" className="p-5 bg-slate-50">
          <h4 className="font-bold">The map couldn’t load</h4>
          <p className="text-sm text-slate-600 mt-2 mb-3">
            You can still browse every venue below or open its Google Maps link.
          </p>
          <button
            className="secondary text-sm"
            onClick={() => {
              setFailed(false)
              setAttempt((value) => value + 1)
            }}
          >
            Retry map
          </button>
        </div>
      )}
      {selected ? (
        <div
          className="p-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center gap-3"
          aria-label="Selected map venue"
        >
          <div className="min-w-0 flex-1" aria-live="polite">
            <h4 className="font-bold break-words">
              {selectedNumber}. {selected.displayName.text}
            </h4>
            <p className="text-sm text-slate-600 mt-1 flex flex-wrap items-center gap-1.5">
              <Star size={15} aria-hidden="true" className="text-amber-700" />
              {typeof selected.rating === 'number'
                ? `${selected.rating.toFixed(1)} / 5 · ${(selected.userRatingCount ?? 0).toLocaleString('en-IN')} reviews`
                : 'No ratings yet'}{' '}
              · Google Maps
            </p>
            <p className="text-sm text-slate-600 mt-1 break-words">{selected.formattedAddress}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              className="primary text-sm flex-1"
              aria-label={`Make a plan at ${selected.displayName.text} from map`}
              onClick={() => onPost(selected)}
            >
              Make a plan here
            </button>
            <button
              className="secondary min-h-11 min-w-11 !p-2"
              aria-label="Clear map selection"
              onClick={() => onSelect(null)}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : (
        <p className="px-4 py-3 text-sm text-slate-600 border-t border-slate-200">
          Pin numbers match the cards below. Load more places to add them to the map.
        </p>
      )}
    </div>
  )
}
