import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import { activityByKey, type Intent } from '../types'

const JAIPUR_CENTER: [number, number] = [75.7873, 26.8905]

interface Props {
  intents: Intent[]
  selectedId: string | null
  onSelect: (id: string | null) => void
}

export default function MapView({ intents, selectedId, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map())

  useEffect(() => {
    if (!containerRef.current) return
    const map = new maplibregl.Map({
      container: containerRef.current,
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
      center: JAIPUR_CENTER,
      zoom: 11.5,
      attributionControl: { compact: true },
    })
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    map.on('click', (e) => {
      // MapLibre synthesizes clicks from pointer events, so a pin click also
      // fires here — only deselect when the click wasn't on a pin.
      const target = e.originalEvent.target as HTMLElement
      if (!target.closest('.intent-pin')) onSelect(null)
    })
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
      markersRef.current.clear()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    for (const marker of markersRef.current.values()) marker.remove()
    markersRef.current.clear()

    for (const intent of intents) {
      const activity = activityByKey(intent.activity)
      const selected = intent.id === selectedId

      const el = document.createElement('div')
      el.className = 'intent-pin'
      el.style.cssText = `
        width: ${selected ? 44 : 36}px; height: ${selected ? 44 : 36}px;
        border-radius: 50% 50% 50% 4px;
        background: ${activity.color};
        border: 2.5px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.35);
        display: flex; align-items: center; justify-content: center;
        font-size: ${selected ? 20 : 16}px;
        transform: rotate(-45deg);
      `
      const inner = document.createElement('span')
      inner.textContent = activity.emoji
      inner.style.transform = 'rotate(45deg)'
      el.appendChild(inner)
      el.addEventListener('click', (e) => {
        e.stopPropagation()
        onSelect(intent.id)
      })

      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([intent.lng, intent.lat])
        .addTo(map)
      markersRef.current.set(intent.id, marker)
    }
  }, [intents, selectedId, onSelect])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !selectedId) return
    const intent = intents.find((i) => i.id === selectedId)
    if (intent) {
      map.easeTo({ center: [intent.lng, intent.lat], zoom: Math.max(map.getZoom(), 13), duration: 500 })
    }
  }, [selectedId, intents])

  // Explicit h-full/w-full: maplibre-gl.css sets .maplibregl-map to
  // position:relative, which overrides Tailwind's `absolute` and would
  // otherwise collapse the container to 0 height.
  return <div ref={containerRef} className="absolute inset-0 h-full w-full" />
}
