import { haversineKm } from './geo'
import type { Intent } from '../types'

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
