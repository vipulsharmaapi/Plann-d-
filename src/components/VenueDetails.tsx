import { useEffect, useState } from 'react'
import { ExternalLink, ImageOff, MapPin, Star, Utensils } from 'lucide-react'
import type { Intent } from '../types'
import { loadVenue, photoUrl, safeExternalUrl, type VenueDetails as Place } from '../lib/venues'

export default function VenueDetails({ intent }: { intent: Intent }) {
  const [place, setPlace] = useState<Place | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [photoIndex, setPhotoIndex] = useState(0)
  const [imageFailed, setImageFailed] = useState(false)
  const { id, venueName, googlePlaceId, lat, lng } = intent
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setFailed(false)
    setPlace(null)
    setPhotoIndex(0)
    setImageFailed(false)
    loadVenue({ venueName, googlePlaceId, lat, lng }, controller.signal)
      .then((p) => {
        if (!controller.signal.aborted) setPlace(p)
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [id, venueName, googlePlaceId, lat, lng, attempt])

  const photos = place?.photos?.slice(0, 5) ?? []
  const photo = photos[photoIndex],
    image = photo && photoUrl(photo)
  const maps =
    safeExternalUrl(place?.googleMapsLinks?.placeUri ?? place?.googleMapsUri) ??
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(intent.venueName + ', Jaipur')}${intent.googlePlaceId ? '&query_place_id=' + encodeURIComponent(intent.googlePlaceId) : ''}`
  const website = safeExternalUrl(place?.websiteUri),
    menu = safeExternalUrl(intent.venueMenuUrl)
  const reviews = safeExternalUrl(place?.googleMapsLinks?.reviewsUri) ?? maps
  return (
    <section className="mt-6 pt-5 border-t border-gray-200" aria-labelledby="venue-heading">
      <h2 id="venue-heading" className="font-bold text-lg text-gray-900">
        About the venue
      </h2>
      {loading ? (
        <p role="status" className="text-sm text-gray-600 py-4">
          Loading venue photos and ratings…
        </p>
      ) : (
        <>
          {image && !imageFailed ? (
            <figure className="mt-3">
              <img
                src={image}
                alt={`${place?.displayName?.text || intent.venueName} — venue photo ${photoIndex + 1}`}
                className="w-full aspect-[3/2] object-cover rounded-xl"
                onError={() => setImageFailed(true)}
              />
              <figcaption className="mt-2 text-xs text-gray-600 flex flex-wrap gap-x-1">
                Photo{(photo.authorAttributions?.length ?? 0) > 1 ? 's' : ''} by{' '}
                {photo.authorAttributions?.length ? (
                  photo.authorAttributions.map((author, i) =>
                    safeExternalUrl(author.uri) ? (
                      <a
                        key={i}
                        href={safeExternalUrl(author.uri)!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline underline-offset-2"
                      >
                        {author.displayName}
                      </a>
                    ) : (
                      <span key={i}>{author.displayName}</span>
                    ),
                  )
                ) : (
                  <span>Google Maps contributors</span>
                )}
              </figcaption>
              {photos.length > 1 && (
                <div className="flex gap-2 mt-2" aria-label="Venue photos">
                  {photos.map((_, i) => (
                    <button
                      key={i}
                      aria-label={`Show venue photo ${i + 1}`}
                      aria-pressed={i === photoIndex}
                      onClick={() => {
                        setPhotoIndex(i)
                        setImageFailed(false)
                      }}
                      className={`w-11 h-11 rounded-lg text-sm font-semibold ${i === photoIndex ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'}`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
              )}
            </figure>
          ) : (
            <p className="flex items-center gap-2 text-sm text-gray-600 my-4">
              <ImageOff size={18} aria-hidden="true" />
              {failed ? 'Venue details could not load.' : 'No venue photo available.'}
            </p>
          )}
          {place && (
            <div className="mt-3 space-y-2 text-sm">
              <p className="font-semibold text-gray-900">
                {place.displayName?.text || intent.venueName}
              </p>
              {typeof place.rating === 'number' ? (
                <a
                  href={reviews}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-1.5 text-gray-800 underline underline-offset-4"
                >
                  <Star
                    size={17}
                    fill="currentColor"
                    className="text-amber-700"
                    aria-hidden="true"
                  />
                  <strong>{place.rating.toFixed(1)}</strong> / 5{' '}
                  <span>
                    ({(place.userRatingCount ?? 0).toLocaleString('en-IN')} Google reviews)
                  </span>
                </a>
              ) : (
                <p className="text-gray-600">No Google rating available.</p>
              )}
              {place.formattedAddress && <p className="text-gray-600">{place.formattedAddress}</p>}
              {place.businessStatus && place.businessStatus !== 'OPERATIONAL' && (
                <p className="text-amber-800">
                  Google lists this venue as{' '}
                  {place.businessStatus.toLowerCase().replaceAll('_', ' ')}. Check before
                  travelling.
                </p>
              )}
              <p className="text-xs text-gray-600" translate="no">
                Google Maps
              </p>
              {place.attributions?.map((a, i) => (
                <p className="text-xs text-gray-600" key={i}>
                  {safeExternalUrl(a.providerUri) ? (
                    <a
                      className="underline"
                      href={safeExternalUrl(a.providerUri)!}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {a.provider}
                    </a>
                  ) : (
                    a.provider
                  )}
                </p>
              ))}
            </div>
          )}
          {!place && !failed && (
            <p className="text-sm text-gray-600">
              Photos and ratings are available for venues linked to a matching Google listing.
            </p>
          )}
          {failed && (
            <button className="secondary text-sm" onClick={() => setAttempt(attempt + 1)}>
              Retry venue details
            </button>
          )}
        </>
      )}
      <div className="flex flex-wrap gap-2 mt-4">
        {menu && (
          <a
            className="secondary inline-flex items-center gap-2 text-sm"
            href={menu}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Utensils size={16} aria-hidden="true" />
            View menu
          </a>
        )}
        {website && (
          <a
            className="secondary inline-flex items-center gap-2 text-sm"
            href={website}
            target="_blank"
            rel="noopener noreferrer"
          >
            Venue website
            <ExternalLink size={15} aria-hidden="true" />
          </a>
        )}
        <a
          className="secondary inline-flex items-center gap-2 text-sm"
          href={maps}
          target="_blank"
          rel="noopener noreferrer"
        >
          <MapPin size={16} aria-hidden="true" />
          View on Google Maps
        </a>
      </div>
      <p className="mt-2 text-xs text-gray-600">
        {menu
          ? 'Menu link added by the host. Check current prices with the venue.'
          : 'No menu link has been added. Check the venue website or ask the host.'}
      </p>
    </section>
  )
}
