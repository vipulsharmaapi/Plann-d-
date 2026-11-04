import { expect, test } from 'vitest'
import { matchingVenue, safeExternalUrl } from '../src/lib/venues'

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
