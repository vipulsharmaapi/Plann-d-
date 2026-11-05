import { createContext, useEffect, useState } from 'react'
import { loadVenue, type VenueDetails, type VenueLocation } from '../lib/venues'

export function usePlanVenue(plan: VenueLocation, enabled = true) {
  const [place, setPlace] = useState<VenueDetails | null>(null)
  const [loading, setLoading] = useState(enabled)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const { venueName, googlePlaceId, lat, lng } = plan
  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    setPlace(null)
    setLoading(true)
    setFailed(false)
    loadVenue({ venueName, googlePlaceId, lat, lng }, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setPlace(value)
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [venueName, googlePlaceId, lat, lng, enabled, attempt])
  return { place, loading, failed, retry: () => setAttempt((n) => n + 1) }
}
export const PlanVenueContext = createContext<ReturnType<typeof usePlanVenue> | null>(null)
