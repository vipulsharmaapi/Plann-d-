import { useEffect, useRef, useState } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MapPin, ArrowRight } from 'lucide-react'
import ActivityIcon from './ActivityIcon'
import { humanDay, type Intent } from '../types'
import { formatTimeRange } from '../lib/time'
import { planArtwork } from '../lib/discovery'
import { GOOGLE_MAP_ID, loadGoogleMaps, onGoogleAuthFailure } from '../lib/googleMaps'

type Entry = {
  marker: google.maps.marker.AdvancedMarkerElement
  pin: HTMLDivElement
  click: () => void
}
export default function JaipurMap({
  plans,
  selected,
  onSelect,
  onDetails,
}: {
  plans: Intent[]
  selected?: Intent
  onSelect: (p: Intent) => void
  onDetails: (p: Intent) => void
}) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<google.maps.Map | null>(null)
  const api = useRef<typeof google | null>(null)
  const markers = useRef(new Map<string, Entry>())
  const current = useRef({ plans, onSelect })
  current.current = { plans, onSelect }
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    const entries = markers.current
    setReady(false)
    setFailed(false)
    const fail = () => {
      if (!active) return
      active = false
      clearTimeout(timeout)
      setFailed(true)
      setReady(false)
    }
    const timeout = setTimeout(fail, 12000)
    const offAuth = onGoogleAuthFailure(fail)
    loadGoogleMaps()
      .then((g) => {
        if (!active || !el.current) return
        api.current = g
        map.current = new g.maps.Map(el.current, {
          center: { lat: 26.892, lng: 75.789 },
          zoom: 12,
          mapId: GOOGLE_MAP_ID,
          disableDefaultUI: true,
          zoomControl: true,
          clickableIcons: false,
          gestureHandling: 'cooperative',
          minZoom: 9,
          maxZoom: 19,
        })
        clearTimeout(timeout)
        setReady(true)
      })
      .catch(fail)
    return () => {
      active = false
      clearTimeout(timeout)
      offAuth()
      for (const { marker, click } of entries.values()) {
        marker.removeEventListener('gmp-click', click)
        marker.map = null
      }
      entries.clear()
      map.current = null
      api.current = null
    }
  }, [attempt])
  useEffect(() => {
    const g = api.current,
      view = map.current
    if (!ready || !g || !view) return
    const ids = new Set(plans.map((p) => p.id))
    for (const [id, entry] of markers.current) {
      if (ids.has(id)) continue
      entry.marker.removeEventListener('gmp-click', entry.click)
      entry.marker.map = null
      markers.current.delete(id)
    }
    for (const p of plans) {
      let entry = markers.current.get(p.id)
      if (!entry) {
        const pin = document.createElement('div')
        const marker = new g.maps.marker.AdvancedMarkerElement({
          map: view,
          content: pin,
          gmpClickable: true,
          position: { lat: p.lat, lng: p.lng },
        })
        const click = () => {
          const plan = current.current.plans.find((item) => item.id === p.id)
          if (plan) current.current.onSelect(plan)
        }
        marker.addEventListener('gmp-click', click)
        entry = { marker, pin, click }
        markers.current.set(p.id, entry)
      }
      entry.pin.innerHTML = renderToStaticMarkup(<ActivityIcon activity={p.activity} size={22} />)
      entry.marker.position = { lat: p.lat, lng: p.lng }
      entry.marker.title = `${p.title} at ${p.venueName}`
    }
  }, [ready, plans])
  useEffect(() => {
    if (!ready) return
    for (const [id, entry] of markers.current) {
      entry.pin.className = `plan-pin ${id === selected?.id ? 'active' : ''}`
      entry.marker.zIndex = id === selected?.id ? 1000 : 1
    }
  }, [ready, plans, selected?.id])
  const coordinates = plans.map((p) => `${p.lat},${p.lng}`).join(';')
  useEffect(() => {
    const g = api.current,
      view = map.current
    if (!ready || !g || !view || !coordinates) return
    const points = coordinates.split(';').map((p) => {
      const [lat, lng] = p.split(',').map(Number)
      return { lat, lng }
    })
    if (points.every((p) => p.lat === points[0].lat && p.lng === points[0].lng)) {
      view.setCenter(points[0])
      view.setZoom(14)
    } else {
      const bounds = new g.maps.LatLngBounds()
      points.forEach((p) => bounds.extend(p))
      view.fitBounds(bounds, { top: 75, bottom: 175, left: 45, right: 45 })
    }
  }, [ready, coordinates])
  return (
    <section className="map-panel" aria-label="Plans on a Jaipur map">
      <div ref={el} className="map-canvas" hidden={failed} />
      <div className="map-area-label">
        <MapPin size={16} />
        Jaipur<span>Meeting places from hosts</span>
      </div>
      {!ready && !failed && (
        <p className="map-error" role="status">
          Loading Google Maps…
        </p>
      )}
      {failed && (
        <div className="map-error" role="alert">
          <p>Google Maps couldn’t load. You can still browse the plans in List.</p>
          <button className="secondary" onClick={() => setAttempt((n) => n + 1)}>
            Retry map
          </button>
        </div>
      )}
      {selected && (
        <button className="map-preview" onClick={() => onDetails(selected)}>
          <img src={planArtwork(selected)} alt="" />
          <span>
            <strong>{selected.title}</strong>
            <span>
              {humanDay(selected.date)}, {formatTimeRange(selected.startsAt, selected.endsAt)}
            </span>
            <span className="spots">
              {Math.max(0, selected.spotsNeeded - selected.spotsFilled)} spots open{' '}
              <ArrowRight size={16} />
            </span>
          </span>
        </button>
      )}
    </section>
  )
}
