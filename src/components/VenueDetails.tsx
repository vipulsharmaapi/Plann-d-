import { useContext, useEffect, useState } from 'react'
import { ExternalLink, ImageOff, MapPin, Star, Utensils, ChevronDown } from 'lucide-react'
import type { Intent } from '../types'
import { photoUrl, safeExternalUrl } from '../lib/venues'
import { PlanVenueContext, usePlanVenue } from '../hooks/usePlanVenue'

export default function VenueDetails({ intent }: { intent: Intent }) {
  const shared = useContext(PlanVenueContext)
  const standalone = usePlanVenue(intent, !shared)
  const { place, loading, failed, retry } = shared ?? standalone
  const [photoIndex, setPhotoIndex] = useState(0)
  const [imageFailed, setImageFailed] = useState(false)
  useEffect(() => {
    setPhotoIndex(0)
    setImageFailed(false)
  }, [place])

  const photos = place?.photos?.slice(0, 5) ?? []
  const photo = photos[photoIndex],
    image = photo && photoUrl(photo)
  const maps =
    safeExternalUrl(place?.googleMapsLinks?.placeUri ?? place?.googleMapsUri) ??
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(intent.venueName + ', Jaipur')}${intent.googlePlaceId ? `&query_place_id=${encodeURIComponent(intent.googlePlaceId)}` : ''}`
  const website = safeExternalUrl(place?.websiteUri),
    menu = safeExternalUrl(intent.venueMenuUrl)
  const reviews = safeExternalUrl(place?.googleMapsLinks?.reviewsUri) ?? maps
  return (
    <section className="plan-venue-section" aria-labelledby="venue-heading">
      <h2 id="venue-heading" className="font-bold text-lg">
        About the venue
      </h2>
      <p className="font-semibold text-sm mt-2">{place?.displayName?.text || intent.venueName}</p>
      {loading ? (
        <p role="status" className="text-sm text-gray-600 mt-2">
          Loading venue details…
        </p>
      ) : (
        <>
          {typeof place?.rating === 'number' ? (
            <a
              href={reviews}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-1.5 text-sm text-gray-600 hover:underline"
            >
              <Star size={16} className="text-amber-700" aria-hidden="true" />
              {place.rating.toFixed(1)} / 5 · {(place.userRatingCount ?? 0).toLocaleString('en-IN')}{' '}
              reviews · Google Maps
            </a>
          ) : (
            <p className="text-sm text-gray-600 mt-2">
              {failed ? 'Venue details could not load.' : 'No Google rating available.'}
            </p>
          )}
          {place?.businessStatus && place.businessStatus !== 'OPERATIONAL' && (
            <p className="text-sm text-amber-800">
              Google lists this venue as {place.businessStatus.toLowerCase().replaceAll('_', ' ')}.
              Check before travelling.
            </p>
          )}
          {failed && (
            <button className="secondary text-sm mt-2" onClick={retry}>
              Retry venue details
            </button>
          )}
        </>
      )}
      <details className="venue-more">
        <summary>
          Photos, reviews and menu
          <ChevronDown size={16} aria-hidden="true" />
        </summary>
        <div className="pb-2">
          {!loading && (
            <>
              {image && !imageFailed ? (
                <figure className="mt-3">
                  <img
                    src={image}
                    alt={`${place?.displayName?.text || intent.venueName}, venue photo ${photoIndex + 1}`}
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
                </figure>
              ) : !failed ? (
                <p className="flex items-center gap-2 text-sm text-gray-600 my-4">
                  <ImageOff size={18} aria-hidden="true" />
                  {imageFailed
                    ? 'This photo could not load. Try another photo or open Google Maps.'
                    : 'No venue photo available.'}
                </p>
              ) : null}
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
              {place?.formattedAddress && (
                <p className="text-sm text-gray-600 mt-3">{place.formattedAddress}</p>
              )}
              {place?.attributions?.map((a, i) => (
                <p className="text-xs text-gray-600 mt-2" key={i}>
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
              ? 'Menu added by the host. Prices may change.'
              : 'Menu not added. Check the venue website.'}
          </p>
        </div>
      </details>
    </section>
  )
}
