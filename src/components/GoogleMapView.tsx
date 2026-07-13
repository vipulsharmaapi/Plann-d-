import { useEffect, useRef, useState } from 'react'
import { GOOGLE_MAP_ID, loadGoogleMaps, onGoogleAuthFailure } from '../lib/googleMaps'
import { createPinEl } from '../lib/pinElement'
import type { Intent } from '../types'

const JAIPUR_CENTER = { lat: 26.8905, lng: 75.7873 }

interface Props {
  intents: Intent[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onFallback: () => void
}

export default function GoogleMapView({ intents, selectedId, onSelect, onFallback }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const markersRef = useRef<Map<string, google.maps.marker.AdvancedMarkerElement>>(new Map())
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    const offAuthFailure = onGoogleAuthFailure(() => {
      if (!cancelled) onFallback()
    })
    loadGoogleMaps()
      .then((g) => {
        if (cancelled || !containerRef.current) return
        const map = new g.maps.Map(containerRef.current, {
          center: JAIPUR_CENTER,
          zoom: 11.5,
          mapId: GOOGLE_MAP_ID,
          disableDefaultUI: true,
          zoomControl: true,
          clickableIcons: false,
        })
        map.addListener('click', () => onSelectRef.current(null))
        mapRef.current = map
        setReady(true)
      })
      .catch(() => {
        // Key missing / API not enabled / quota — fall back to the OSM map
        if (!cancelled) onFallback()
      })
    return () => {
      cancelled = true
      offAuthFailure()
      mapRef.current = null
      markersRef.current.clear()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return

    for (const marker of markersRef.current.values()) marker.map = null
    markersRef.current.clear()

    for (const intent of intents) {
      const el = createPinEl(intent.activity, intent.id === selectedId)
      const marker = new google.maps.marker.AdvancedMarkerElement({
        map,
        position: { lat: intent.lat, lng: intent.lng },
        content: el,
        gmpClickable: true,
      })
      marker.addEventListener('gmp-click', () => onSelectRef.current(intent.id))
      markersRef.current.set(intent.id, marker)
    }
  }, [intents, selectedId, ready])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready || !selectedId) return
    const intent = intents.find((i) => i.id === selectedId)
    if (intent) {
      map.panTo({ lat: intent.lat, lng: intent.lng })
      const zoom = map.getZoom() ?? 11.5
      if (zoom < 13) map.setZoom(13)
    }
  }, [selectedId, intents, ready])

  return <div ref={containerRef} className="absolute inset-0 h-full w-full" />
}
