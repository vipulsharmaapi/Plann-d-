import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { renderToStaticMarkup } from 'react-dom/server'
import { MapPin, ArrowRight } from 'lucide-react'
import ActivityIcon from './ActivityIcon'
import { humanDay, type Intent } from '../types'
import { formatTimeRange } from '../lib/time'
import { planArtwork } from '../lib/discovery'
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
  const el = useRef<HTMLDivElement>(null),
    map = useRef<L.Map | null>(null),
    layer = useRef<L.LayerGroup | null>(null),
    select = useRef(onSelect)
  useEffect(() => {
    select.current = onSelect
  }, [onSelect])
  const [error, setError] = useState(false)
  useEffect(() => {
    if (!el.current) return
    const m = L.map(el.current, {
      zoomControl: false,
      scrollWheelZoom: false,
      minZoom: 9,
      maxZoom: 18,
    }).setView([26.892, 75.789], 12)
    map.current = m
    L.control.zoom({ position: 'topright' }).addTo(m)
    m.attributionControl.setPrefix(false)
    const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(m)
    let failures = 0
    tiles.on('tileerror', () => {
      if (++failures > 4) setError(true)
    })
    tiles.on('tileload', () => setError(false))
    layer.current = L.layerGroup().addTo(m)
    const ro = new ResizeObserver(() => m.invalidateSize())
    ro.observe(el.current)
    return () => {
      ro.disconnect()
      m.remove()
      map.current = null
      layer.current = null
    }
  }, [])
  useEffect(() => {
    if (!layer.current) return
    const focusedPlan = (document.activeElement as HTMLElement | null)?.dataset.planId
    layer.current.clearLayers()
    for (const p of plans) {
      const button = document.createElement('button')
      button.className = `plan-pin ${p.id === selected?.id ? 'active' : ''}`
      button.type = 'button'
      button.dataset.planId = p.id
      button.setAttribute('aria-pressed', String(p.id === selected?.id))
      button.setAttribute('aria-label', `${p.title} at ${p.venueName}`)
      button.innerHTML = renderToStaticMarkup(<ActivityIcon activity={p.activity} size={22} />)
      button.addEventListener('click', () => select.current(p))
      L.marker([p.lat, p.lng], {
        icon: L.divIcon({
          className: 'plan-pin-wrap',
          html: button,
          iconSize: [44, 44],
          iconAnchor: [22, 22],
        }),
        keyboard: false,
      }).addTo(layer.current)
      if (focusedPlan === p.id) button.focus({ preventScroll: true })
    }
  }, [plans, selected?.id])
  const coordinates = plans.map((p) => `${p.lat},${p.lng}`).join(';')
  useEffect(() => {
    if (map.current && coordinates)
      map.current.fitBounds(
        coordinates.split(';').map((pair) => pair.split(',').map(Number) as [number, number]),
        { paddingTopLeft: [45, 65], paddingBottomRight: [45, 165], maxZoom: 14, animate: false },
      )
  }, [coordinates])
  return (
    <section className="map-panel" aria-label="Plans on a Jaipur map">
      <div ref={el} className="map-canvas" />
      <div className="map-area-label">
        <MapPin size={16} />
        Jaipur<span>Meeting places from hosts</span>
      </div>
      {error && (
        <div className="map-error" role="status">
          Map tiles couldn’t load. You can still browse the plans.
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
