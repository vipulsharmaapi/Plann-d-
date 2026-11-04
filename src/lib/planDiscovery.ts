import { ACTIVITIES, type Intent } from '../types'
import { haversineKm } from './geo'
import type { DiscoverableVenue } from './venues'

export const normalizeSearch = (value: string) =>
  value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
export function matchesPlan(plan: Intent, query: string) {
  const text = normalizeSearch(
    `${plan.title} ${plan.venueName} ${plan.venueArea ?? ''} ${plan.activity}`,
  )
  return normalizeSearch(query)
    .trim()
    .split(/\s+/)
    .every((word) => text.includes(word))
}
export function plansAtVenue(plans: Intent[], placeId: string, venue?: DiscoverableVenue) {
  const venueName = (name: string) =>
    normalizeSearch(name.split(',')[0]).replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
  function matchesVenue(plan: Intent) {
    if (plan.googlePlaceId) return plan.googlePlaceId === placeId
    if (!venue || venueName(venue.displayName.text).length < 5) return false
    // Older plans lack a provider ID. Require both the full venue/branch name
    // and a close map point; show these as approximate matches in the UI.
    return venueName(plan.venueName) === venueName(venue.displayName.text) &&
      haversineKm(plan, { lat: venue.location.latitude, lng: venue.location.longitude }) <= 0.1
  }
  return plans
    .filter(
      (p) =>
        matchesVenue(p) &&
        !['cancelled', 'expired'].includes(p.status ?? '') &&
        (!p.endsAtIso || Date.parse(p.endsAtIso) > Date.now()),
    )
    .sort(
      (a, b) =>
        Number(a.spotsFilled >= a.spotsNeeded) - Number(b.spotsFilled >= b.spotsNeeded) ||
        (a.startsAtIso ?? '').localeCompare(b.startsAtIso ?? ''),
    )
}
export function activeCategories(plans: Intent[]) {
  const counts = new Map<string, number>()
  for (const plan of plans) counts.set(plan.activity, (counts.get(plan.activity) ?? 0) + 1)
  return [...ACTIVITIES].sort((a, b) => (counts.get(b.key) ?? 0) - (counts.get(a.key) ?? 0))
}
