import { useEffect, useRef, useState } from 'react'
import {
  discoverVenues,
  sortVenues,
  type DiscoverableVenue,
  type VenueBounds,
  type VenueSearch,
} from '../lib/venues'
import type { ActivityKey } from '../types'

export function useVenues(selection: VenueSearch | ActivityKey | null, bounds?: VenueBounds) {
  const [places, setPlaces] = useState<DiscoverableVenue[]>([])
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [token, setToken] = useState<string>()
  const [nextPageToken, setNextPageToken] = useState<string>()
  const [attempt, setAttempt] = useState(0)
  const identity = JSON.stringify([selection, bounds])
  const previous = useRef(identity)
  useEffect(() => {
    // A new query replaces results. A failed page preserves already loaded venues.
    const changed = previous.current !== identity
    previous.current = identity
    if (changed) {
      setPlaces([])
      setToken(undefined)
      setNextPageToken(undefined)
    }
    if (!selection) {
      setState('idle')
      return
    }
    const page = changed ? undefined : token
    const controller = new AbortController()
    let current = true
    const timeout = setTimeout(() => controller.abort(), 12000)
    setState('loading')
    discoverVenues(selection, controller.signal, page, bounds)
      .then((result) => {
        if (!current) return
        setPlaces((old) =>
          sortVenues(page ? [...old, ...result.places] : result.places, 'relevance'),
        )
        setNextPageToken(result.nextPageToken)
        setState('ready')
      })
      .catch(() => {
        if (current) setState('error')
      })
      .finally(() => clearTimeout(timeout))
    return () => {
      current = false
      clearTimeout(timeout)
      controller.abort()
    }
    // Query identity is stable even when the caller creates a new selection object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity, token, attempt])
  return {
    places,
    state,
    retry: () => setAttempt((n) => n + 1),
    nextPageToken,
    loadMore: () => {
      if (nextPageToken && state !== 'loading') setToken(nextPageToken)
    },
  }
}
