import { useEffect, useRef, useState } from 'react'
import { GOOGLE_MAP_ID, loadGoogleMaps, onGoogleAuthFailure } from '../lib/googleMaps'
type Point = { lat: number; lng: number }
export default function VenuePinMap({
  value,
  onChange,
}: {
  value: Point | null
  onChange: (p: Point) => void
}) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<google.maps.Map | null>(null)
  const marker = useRef<google.maps.marker.AdvancedMarkerElement | null>(null)
  const current = useRef({ value, onChange })
  current.current = { value, onChange }
  const [state, setState] = useState('loading')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true,
      listener: google.maps.MapsEventListener | undefined
    setState('loading')
    function fail() {
      if (!active) return
      active = false
      clearTimeout(timeout)
      setState('error')
    }
    const timeout = setTimeout(fail, 12000)
    const off = onGoogleAuthFailure(fail)
    loadGoogleMaps()
      .then((g) => {
        if (!active || !el.current) return
        map.current = new g.maps.Map(el.current, {
          center: current.current.value ?? { lat: 26.8905, lng: 75.7873 },
          zoom: current.current.value ? 14 : 11,
          mapId: GOOGLE_MAP_ID,
          disableDefaultUI: true,
          zoomControl: true,
          clickableIcons: false,
          gestureHandling: 'cooperative',
        })
        marker.current = new g.maps.marker.AdvancedMarkerElement({
          map: map.current,
          position: current.current.value ?? undefined,
          title: 'Meeting place',
        })
        listener = map.current.addListener('click', (e: google.maps.MapMouseEvent) => {
          if (e.latLng) current.current.onChange({ lat: e.latLng.lat(), lng: e.latLng.lng() })
        })
        clearTimeout(timeout)
        setState('ready')
      })
      .catch(fail)
    return () => {
      active = false
      clearTimeout(timeout)
      off()
      listener?.remove()
      if (marker.current) marker.current.map = null
      marker.current = null
      map.current = null
    }
  }, [attempt])
  useEffect(() => {
    if (state !== 'ready' || !marker.current) return
    marker.current.position = value ?? undefined
    if (value) map.current?.panTo(value)
  }, [value, state])
  return (
    <div className="venue-pin-map">
      <div ref={el} className="venue-pin-canvas" hidden={state === 'error'} />
      {state === 'loading' && <p role="status">Loading Google Maps…</p>}
      {state === 'error' && (
        <div role="alert">
          <p>Google Maps couldn’t load.</p>
          <button type="button" className="text-button" onClick={() => setAttempt((n) => n + 1)}>
            Retry map
          </button>
        </div>
      )}
    </div>
  )
}
