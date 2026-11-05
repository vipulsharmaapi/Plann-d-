import { haversineKm } from './geo'
import type { ActivityKey, Intent, VenueDraft } from '../types'

export type VenueLocation = Pick<Intent, 'venueName' | 'googlePlaceId' | 'lat' | 'lng'>

const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined
export function safeExternalUrl(value?: string | null): string | null {
  if (!value || value.length > 2048) return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null
  } catch {
    return null
  }
}

export interface PlacePhoto {
  name: string
  authorAttributions?: { displayName: string; uri?: string }[]
}
export interface VenueDetails {
  id: string
  displayName?: { text?: string }
  formattedAddress?: string
  location?: { latitude: number; longitude: number }
  rating?: number
  userRatingCount?: number
  photos?: PlacePhoto[]
  websiteUri?: string
  googleMapsUri?: string
  googleMapsLinks?: { placeUri?: string; reviewsUri?: string; photosUri?: string }
  attributions?: { provider: string; providerUri?: string }[]
  businessStatus?: string
  primaryType?: string
  types?: string[]
}

export const VENUE_CATEGORIES: { activity: ActivityKey; label: string; query: string }[] = [
  { activity: 'football', label: 'Football', query: 'football grounds and turfs' },
  { activity: 'coffee', label: 'Cafés', query: 'cafes' },
  { activity: 'badminton', label: 'Badminton', query: 'badminton courts' },
  { activity: 'cricket', label: 'Cricket', query: 'cricket grounds and box cricket' },
  { activity: 'food', label: 'Restaurants', query: 'restaurants' },
  { activity: 'boardgames', label: 'Board games', query: 'board game cafes' },
  { activity: 'tennis', label: 'Tennis', query: 'tennis courts' },
  { activity: 'basketball', label: 'Basketball', query: 'basketball courts' },
  { activity: 'running', label: 'Running', query: 'parks with running tracks' },
  { activity: 'cycling', label: 'Cycling', query: 'parks for cycling' },
  { activity: 'gym', label: 'Gyms', query: 'gyms' },
  { activity: 'swimming', label: 'Swimming', query: 'swimming pools' },
  { activity: 'movies', label: 'Cinemas', query: 'movie theaters' },
  { activity: 'trekking', label: 'Trekking', query: 'hiking trails' },
  { activity: 'other', label: 'Other places', query: 'public places to meet friends' },
]

export type DiscoverableVenue = VenueDetails & {
  displayName: { text: string }
}
export type VenueBounds = { south: number; west: number; north: number; east: number }
export const JAIPUR_AREAS = [
  'Vaishali Nagar',
  'Mansarovar',
  'C-Scheme',
  'Malviya Nagar',
  'Civil Lines',
  'Pink City',
  'Raja Park',
  'Jagatpura',
  'Tonk Road',
]
export function venueNeighbourhood(place: VenueDetails, fallback = '') {
  return (
    JAIPUR_AREAS.find((area) =>
      (place.formattedAddress ?? '')
        .toLowerCase()
        .replace(/[-\s]/g, '')
        .includes(area.toLowerCase().replace(/[-\s]/g, '')),
    ) ?? fallback
  )
}
export function hasVenueLocation(
  place: DiscoverableVenue,
): place is DiscoverableVenue & { location: { latitude: number; longitude: number } } {
  return (
    !!place.location &&
    Number.isFinite(place.location.latitude) &&
    Number.isFinite(place.location.longitude)
  )
}
export type VenueSort = 'rating' | 'reviews' | 'relevance'
export interface VenueSearch {
  query: string
  area: string
}

export function venueSearchText(search: VenueSearch): string {
  const query = search.query.trim().replace(/\s+/g, ' ').slice(0, 120)
  const area = search.area.trim().replace(/\s+/g, ' ').slice(0, 80)
  if (!query) throw new Error('Enter a venue or activity to search')
  return `${query}${area ? ` near ${area}` : ''}, Jaipur, Rajasthan, India`
}

// A search can span categories. Prefer the activity the person asked for,
// then the venue's name and type; the host can change it in the plan editor.
export function venueActivity(place: VenueDetails, query: string): ActivityKey {
  const patterns: [ActivityKey, RegExp][] = [
    ['boardgames', /\bboard\s*games?\b/i],
    ['football', /\b(football|soccer|futsal)\b/i],
    ['badminton', /\bbadminton\b/i],
    ['cricket', /\bcricket\b/i],
    ['basketball', /\bbasketball\b/i],
    ['tennis', /\btennis\b/i],
    ['swimming', /\b(swim(ming)?|pools?)\b/i],
    ['cycling', /\b(cycling|bicycl\w*)\b/i],
    ['running', /\b(running|jogging)\b/i],
    ['trekking', /\b(trekking|hiking|trails?)\b/i],
    ['gym', /\b(gyms?|fitness)\b/i],
    ['movies', /\b(movies?|cinemas?|theat(er|re)s?)\b/i],
    ['coffee', /\b(cafes?|coffee|roastery)\b/i],
    ['food', /\b(restaurants?|food|dining)\b/i],
  ]
  for (const text of [query, place.displayName?.text ?? '']) {
    const normalized = text.normalize('NFD').replace(/\p{M}/gu, '')
    const match = patterns.find(([, pattern]) => pattern.test(normalized))
    if (match) return match[0]
  }
  const types = [place.primaryType, ...(place.types ?? [])]
  for (const [type, activity] of Object.entries({
    cafe: 'coffee',
    coffee_shop: 'coffee',
    restaurant: 'food',
    gym: 'gym',
    movie_theater: 'movies',
    swimming_pool: 'swimming',
    hiking_area: 'trekking',
  } as const)) {
    if (types.includes(type)) return activity
  }
  return 'other'
}

// Text-search location bias alone is not a boundary. Keep every selectable
// result in the same Jaipur area supported by the existing posting form.
export function isDiscoverableVenue(place: VenueDetails): place is DiscoverableVenue {
  return !!(
    /^[A-Za-z0-9_-]{10,255}$/.test(place.id) &&
    place.displayName?.text?.trim() &&
    ![
      'locality',
      'sublocality',
      'neighborhood',
      'postal_code',
      'route',
      'street_address',
      'country',
      'administrative_area_level_1',
      'administrative_area_level_2',
    ].includes(place.primaryType ?? '') &&
    !(place.types?.includes('political') && !place.types.includes('point_of_interest')) &&
    (place.location
      ? Number.isFinite(place.location.latitude) &&
        Number.isFinite(place.location.longitude) &&
        Math.abs(place.location.latitude - 26.8905) < 0.55 &&
        Math.abs(place.location.longitude - 75.7873) < 0.55
      : /\bJaipur\b/i.test(place.formattedAddress ?? '')) &&
    (!place.businessStatus || place.businessStatus === 'OPERATIONAL')
  )
}

export function sortVenues(places: DiscoverableVenue[], sort: VenueSort) {
  const unique = [...new Map(places.map((place) => [place.id, place])).values()]
  if (sort === 'relevance') return unique
  return unique.sort((a, b) =>
    sort === 'reviews'
      ? (b.userRatingCount ?? 0) - (a.userRatingCount ?? 0) || (b.rating ?? 0) - (a.rating ?? 0)
      : (b.rating ?? 0) - (a.rating ?? 0) || (b.userRatingCount ?? 0) - (a.userRatingCount ?? 0),
  )
}

export function venueDraft(
  place: DiscoverableVenue,
  activity: ActivityKey,
  area?: string,
): VenueDraft {
  return {
    activity,
    venueName: place.displayName.text.slice(0, 80),
    ...(venueNeighbourhood(place, area?.trim())
      ? { venueArea: venueNeighbourhood(place, area?.trim()).slice(0, 100) }
      : {}),
    googlePlaceId: place.id,
    ...(hasVenueLocation(place)
      ? { lat: place.location.latitude, lng: place.location.longitude }
      : {}),
  }
}

export async function discoverVenues(
  selection: ActivityKey | VenueSearch,
  signal: AbortSignal,
  pageToken?: string,
  bounds?: VenueBounds,
): Promise<{ places: DiscoverableVenue[]; nextPageToken?: string }> {
  if (!key) throw new Error('Venue search is not configured')
  const textQuery =
    typeof selection === 'string'
      ? `${VENUE_CATEGORIES.find((c) => c.activity === selection)!.query} in Jaipur, Rajasthan, India`
      : venueSearchText(selection)
  const result = (await request(
    'places:searchText',
    'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.photos,places.websiteUri,places.googleMapsUri,places.attributions,places.businessStatus,places.primaryType,places.types,nextPageToken',
    signal,
    {
      textQuery,
      ...(bounds
        ? {
            locationRestriction: {
              rectangle: {
                low: { latitude: bounds.south, longitude: bounds.west },
                high: { latitude: bounds.north, longitude: bounds.east },
              },
            },
          }
        : {
            locationBias: {
              circle: { center: { latitude: 26.8905, longitude: 75.7873 }, radius: 35000 },
            },
          }),
      rankPreference: 'RELEVANCE',
      languageCode: 'en',
      regionCode: 'IN',
      pageSize: 12,
      ...(pageToken ? { pageToken } : {}),
    },
  )) as { places?: VenueDetails[]; nextPageToken?: string }
  return {
    places: (result.places ?? [])
      .filter(isDiscoverableVenue)
      .filter(
        (place) =>
          !bounds ||
          !hasVenueLocation(place) ||
          (place.location.latitude >= bounds.south &&
            place.location.latitude <= bounds.north &&
            place.location.longitude >= bounds.west &&
            place.location.longitude <= bounds.east),
      ),
    nextPageToken: result.nextPageToken,
  }
}

async function request(
  path: string,
  fields: string,
  signal: AbortSignal,
  body?: object,
): Promise<unknown> {
  const response = await fetch(`https://places.googleapis.com/v1/${path}`, {
    method: body ? 'POST' : 'GET',
    signal,
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key!,
      'X-Goog-FieldMask': fields,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  if (!response.ok) throw new Error('Venue information is temporarily unavailable')
  return response.json()
}

// Older plans have no place ID. Accept only an exact normalized name nearby;
// never attach another branch's photo or rating merely because it ranked first.
const normalizedName = (s: string) =>
  s
    .toLowerCase()
    .replace(/\|.*$/, '')
    .split(',')[0]
    .replace(/[^\p{L}\p{N}]/gu, '')
export function matchingVenue(
  plan: VenueLocation,
  places: VenueDetails[],
): VenueDetails | undefined {
  const matches = places.filter(
    (p) =>
      p.location &&
      normalizedName(p.displayName?.text ?? '') === normalizedName(plan.venueName) &&
      haversineKm(plan, { lat: p.location.latitude, lng: p.location.longitude }) < 0.3,
  )
  return matches.length === 1 ? matches[0] : undefined
}

export async function loadVenue(
  plan: VenueLocation,
  signal: AbortSignal,
): Promise<VenueDetails | null> {
  if (!key) return null
  let id = plan.googlePlaceId
  if (!id) {
    const results = (await request(
      'places:searchText',
      'places.id,places.displayName,places.location',
      signal,
      {
        textQuery: `${plan.venueName}, Jaipur`,
        locationBias: {
          circle: { center: { latitude: plan.lat, longitude: plan.lng }, radius: 500 },
        },
        pageSize: 3,
      },
    )) as { places?: VenueDetails[] }
    id = matchingVenue(plan, results.places ?? [])?.id
  }
  if (!id || !/^[A-Za-z0-9_-]{10,255}$/.test(id)) return null
  return (await request(
    `places/${encodeURIComponent(id)}`,
    'id,displayName,formattedAddress,rating,userRatingCount,photos,websiteUri,googleMapsUri,googleMapsLinks,attributions,businessStatus',
    signal,
  )) as VenueDetails
}

export function photoUrl(photo: PlacePhoto): string | null {
  if (!key || !/^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/.test(photo.name)) return null
  return `https://places.googleapis.com/v1/${photo.name}/media?maxWidthPx=900&maxHeightPx=600&key=${encodeURIComponent(key)}`
}
