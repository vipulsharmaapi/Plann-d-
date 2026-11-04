import { expect, test } from 'vitest'
import {
  matchingVenue,
  safeExternalUrl,
  isDiscoverableVenue,
  sortVenues,
  venueDraft,
} from '../src/lib/venues'

test('venue enrichment rejects a different branch, ambiguous matches and different names', () => {
  const plan = { venueName: 'Roastery Coffee House | Vaishali Nagar, 96', lat: 26.9, lng: 75.8 }
  const match = {
    id: 'ChIJexactplace',
    displayName: { text: 'Roastery Coffee House' },
    location: { latitude: 26.9001, longitude: 75.8001 },
  }
  expect(matchingVenue(plan, [match])?.id).toBe(match.id)
  expect(matchingVenue(plan, [match, { ...match, id: 'ChIJotherplace' }])).toBeUndefined()
  expect(
    matchingVenue(plan, [{ ...match, location: { latitude: 27, longitude: 76 } }]),
  ).toBeUndefined()
  expect(
    matchingVenue(plan, [{ ...match, displayName: { text: 'Another coffee house' } }]),
  ).toBeUndefined()
})

test('discovery excludes closed, distant and incomplete venues before a host can select them', () => {
  const place = {
    id: 'ChIJexample123',
    displayName: { text: 'Example turf' },
    location: { latitude: 26.9, longitude: 75.8 },
  }
  expect(isDiscoverableVenue(place)).toBe(true)
  for (const candidate of [
    { ...place, businessStatus: 'CLOSED_PERMANENTLY' },
    { ...place, businessStatus: 'CLOSED_TEMPORARILY' },
    { ...place, location: { latitude: 28.6, longitude: 77.2 } },
    { ...place, location: undefined },
    { ...place, displayName: { text: '' } },
    { ...place, id: 'bad/path' },
  ])
    expect(isDiscoverableVenue(candidate)).toBe(false)
})

test('rating and review sorting deduplicate pages and retain unrated venues; drafts use the exact branch ID and coordinates', () => {
  const a = {
    id: 'ChIJexample123',
    displayName: { text: 'Example turf' },
    location: { latitude: 26.9, longitude: 75.8 },
    rating: 4.8,
    userRatingCount: 21,
  }
  const b = { ...a, id: 'ChIJexample456', rating: 4.5, userRatingCount: 1040 }
  const c = { ...a, id: 'ChIJexample789', rating: undefined, userRatingCount: undefined }
  expect(sortVenues([b, c, a, b], 'rating').map((p) => p.id)).toEqual([a.id, b.id, c.id])
  expect(sortVenues([a, b, c], 'reviews').map((p) => p.id)).toEqual([b.id, a.id, c.id])
  expect(sortVenues([b, a, c], 'relevance').map((p) => p.id)).toEqual([b.id, a.id, c.id])
  expect(venueDraft(a, 'football')).toEqual({
    activity: 'football',
    venueName: 'Example turf',
    googlePlaceId: a.id,
    lat: 26.9,
    lng: 75.8,
  })
})

test('menu and provider links allow only complete HTTPS URLs without embedded credentials', () => {
  for (const url of [
    'javascript:alert(1)',
    'data:text/html,hello',
    '//example.com',
    'https://user:pass@example.com',
    'http://example.com',
  ])
    expect(safeExternalUrl(url)).toBeNull()
  expect(safeExternalUrl('https://example.com/menu.pdf')).toBe('https://example.com/menu.pdf')
})
