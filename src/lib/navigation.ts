import { useSyncExternalStore } from 'react'

const EVENT = 'plannd:navigate'
const subscribe = (listener: () => void) => {
  window.addEventListener('popstate', listener)
  window.addEventListener(EVENT, listener)
  return () => {
    window.removeEventListener('popstate', listener)
    window.removeEventListener(EVENT, listener)
  }
}
export function useUrlParams() {
  return new URLSearchParams(useSyncExternalStore(subscribe, () => location.search))
}
export function navigate(
  changes: Record<string, string | null>,
  mode: 'push' | 'replace' = 'push',
  state?: Record<string, unknown>,
) {
  const url = new URL(location.href)
  for (const [key, value] of Object.entries(changes)) {
    if (value) url.searchParams.set(key, value)
    else url.searchParams.delete(key)
  }
  if (url.href === location.href) return
  const next = state ?? (mode === 'replace' ? history.state : null)
  history[mode === 'push' ? 'pushState' : 'replaceState'](next, '', url.pathname + url.search)
  window.dispatchEvent(new Event(EVENT))
}
export function useUrlValue(key: string, fallback = '') {
  const params = useUrlParams()
  return [
    params.get(key) ?? fallback,
    (value: string) => navigate({ [key]: value || null }, 'replace'),
  ] as const
}

// Tab-local intent checkpoint. No password, code or private profile data.
export function readAuthIntent(): {
  action: 'post' | 'plan'
  venue?: import('../types').VenueDraft
  at: number
} | null {
  try {
    const data = JSON.parse(sessionStorage.getItem('plannd:auth-intent') || 'null')
    if (
      !data ||
      !['post', 'plan'].includes(data.action) ||
      !Number.isFinite(data.at) ||
      Date.now() - data.at > 1800000 ||
      data.at > Date.now() + 60000
    )
      return null
    if (
      data.venue &&
      (typeof data.venue.venueName !== 'string' ||
        data.venue.venueName.length > 200 ||
        typeof data.venue.activity !== 'string' ||
        !/^[A-Za-z0-9_-]{10,255}$/.test(data.venue.googlePlaceId) ||
        !Number.isFinite(data.venue.lat) ||
        !Number.isFinite(data.venue.lng))
    )
      return null
    return data
  } catch {
    return null
  }
}
export function rememberAuthIntent(
  action: 'post' | 'plan' | null,
  venue?: import('../types').VenueDraft | null,
) {
  try {
    if (action)
      sessionStorage.setItem(
        'plannd:auth-intent',
        JSON.stringify({ action, venue, at: Date.now() }),
      )
    else sessionStorage.removeItem('plannd:auth-intent')
  } catch {
    /* Auth still works when optional browser storage is unavailable. */
  }
}
