import { ACTIVITIES, type Intent } from '../types'

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
export function plansAtVenue(plans: Intent[], placeId: string) {
  return plans
    .filter(
      (p) =>
        p.googlePlaceId === placeId &&
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
