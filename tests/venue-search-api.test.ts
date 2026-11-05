import { afterEach, expect, test, vi } from 'vitest'
import { venueActivity, venueSearchText, isDiscoverableVenue } from '../src/lib/venues'
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.resetModules()
})

test('keyword and area queries are normalized, bounded, scoped to Jaipur and reject empty keywords', () => {
  expect(venueSearchText({ query: '  cafes   with games ', area: '  Vaishali   Nagar ' })).toBe(
    'cafes with games near Vaishali Nagar, Jaipur, Rajasthan, India',
  )
  expect(venueSearchText({ query: 'football Mansarovar', area: '' })).toBe(
    'football Mansarovar, Jaipur, Rajasthan, India',
  )
  expect(() => venueSearchText({ query: '  ', area: 'Jaipur' })).toThrow()
  expect(venueSearchText({ query: 'a'.repeat(150), area: 'b'.repeat(100) }).length).toBeLessThan(
    240,
  )
})

test('search activities follow explicit intent, then venue evidence, with an editable other fallback', () => {
  const place = { id: 'ChIJsearchcafe123', displayName: { text: 'Example' }, primaryType: 'cafe' }
  expect(venueActivity(place, 'board games near cafés')).toBe('boardgames')
  expect(venueActivity(place, 'CAFÉS')).toBe('coffee')
  expect(venueActivity(place, 'Example')).toBe('coffee')
  expect(
    venueActivity(
      { ...place, primaryType: undefined, displayName: { text: 'Gymkhana Club' } },
      'Gymkhana',
    ),
  ).toBe('other')
  expect(venueActivity({ ...place, primaryType: undefined }, 'cricket')).toBe('cricket')
  expect(
    isDiscoverableVenue({
      ...place,
      location: { latitude: 26.9, longitude: 75.8 },
      primaryType: 'neighborhood',
    }),
  ).toBe(false)
})

test('Google receives the same keyword and area on subsequent pages and non-venue or distant results are removed', async () => {
  vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'test-only')
  vi.resetModules()
  const { discoverVenues } = await import('../src/lib/venues')
  const valid = {
    id: 'ChIJsearchcafe123',
    displayName: { text: 'Example café' },
    primaryType: 'cafe',
    location: { latitude: 26.9, longitude: 75.8 },
  }
  const fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      places: [
        valid,
        { ...valid, primaryType: 'locality' },
        { ...valid, location: { latitude: 28.6, longitude: 77.2 } },
      ],
      nextPageToken: 'page2',
    }),
  })
  vi.stubGlobal('fetch', fetch)
  const criteria = { query: 'cafes', area: 'Vaishali Nagar' },
    signal = new AbortController().signal
  expect((await discoverVenues(criteria, signal)).places).toEqual([valid])
  await discoverVenues(criteria, signal, 'page2')
  const first = JSON.parse(fetch.mock.calls[0][1].body),
    second = JSON.parse(fetch.mock.calls[1][1].body)
  expect(first.textQuery).toBe('cafes near Vaishali Nagar, Jaipur, Rajasthan, India')
  expect(second).toEqual({ ...first, pageToken: 'page2' })
  expect(fetch.mock.calls[0][1].signal).toBe(signal)
})

test('explicit area search sends bounds and excludes located venues outside them while retaining unlocated Jaipur rows', async () => {
  vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'test-only')
  vi.resetModules()
  const { discoverVenues } = await import('../src/lib/venues')
  const place = {
    id: 'ChIJareaexample',
    displayName: { text: 'Example café' },
    formattedAddress: 'Jaipur',
    location: { latitude: 26.9, longitude: 75.8 },
  }
  const unlocated = { ...place, id: 'ChIJunlocatedarea', location: undefined }
  const fetcher = vi
    .fn()
    .mockResolvedValue({
      ok: true,
      json: async () => ({
        places: [
          place,
          { ...place, id: 'ChIJoutsidearea', location: { latitude: 26.96, longitude: 75.86 } },
          unlocated,
        ],
      }),
    })
  vi.stubGlobal('fetch', fetcher)
  const bounds = { south: 26.89, west: 75.79, north: 26.91, east: 75.81 }
  const result = await discoverVenues(
    { query: 'café', area: '' },
    new AbortController().signal,
    undefined,
    bounds,
  )
  expect(result.places.map((p) => p.id)).toEqual([place.id, unlocated.id])
  const body = JSON.parse(fetcher.mock.calls[0][1].body)
  expect(body.locationRestriction.rectangle).toEqual({
    low: { latitude: 26.89, longitude: 75.79 },
    high: { latitude: 26.91, longitude: 75.81 },
  })
  expect(body.locationBias).toBeUndefined()
})
