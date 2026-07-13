import { importLibrary, setOptions } from '@googlemaps/js-api-loader'

export const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined
// AdvancedMarkerElement needs a map ID; DEMO_MAP_ID is Google's sanctioned
// default. Set VITE_GOOGLE_MAP_ID for a custom-styled map later.
export const GOOGLE_MAP_ID = (import.meta.env.VITE_GOOGLE_MAP_ID as string | undefined) || 'DEMO_MAP_ID'

// Auth-class failures (API not enabled, referrer blocked, bad key) surface
// asynchronously AFTER the script loads — Google reports them only via the
// global gm_authFailure callback. Fan that out so map views can fall back.
let authFailed = false
const authFailureCbs = new Set<() => void>()
;(window as unknown as { gm_authFailure?: () => void }).gm_authFailure = () => {
  authFailed = true
  authFailureCbs.forEach((cb) => cb())
}

export function onGoogleAuthFailure(cb: () => void): () => void {
  if (authFailed) cb()
  authFailureCbs.add(cb)
  return () => authFailureCbs.delete(cb)
}

let promise: Promise<typeof google> | null = null

export function loadGoogleMaps(): Promise<typeof google> {
  if (!GOOGLE_MAPS_KEY) return Promise.reject(new Error('Google Maps key not configured'))
  if (!promise) {
    setOptions({ key: GOOGLE_MAPS_KEY, v: 'weekly' })
    promise = (async () => {
      await importLibrary('maps')
      await importLibrary('marker')
      return window.google
    })()
    // Allow a retry if the first load fails (e.g. flaky network)
    promise.catch(() => {
      promise = null
    })
  }
  return promise
}
