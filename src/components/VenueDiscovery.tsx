import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ExternalLink, ImageOff, MapPin, Star } from 'lucide-react'
import {
  discoverVenues,
  photoUrl,
  safeExternalUrl,
  sortVenues,
  venueDraft,
  VENUE_CATEGORIES,
  type DiscoverableVenue,
  type VenueSort,
} from '../lib/venues'
import type { ActivityKey, VenueDraft } from '../types'

interface Props {
  activity: ActivityKey
  onActivity: (activity: ActivityKey) => void
  onPost: (draft: VenueDraft) => void
}

export default function VenueDiscovery({ activity, onActivity, onPost }: Props) {
  const [expanded, setExpanded] = useState(false)
  const categories = VENUE_CATEGORIES.filter(
    (category, index) => expanded || index < 6 || category.activity === activity,
  )
  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-6" role="group" aria-label="Find places by activity">
        {categories.map((category, index) => (
          <button
            key={category.activity}
            className={`${activity === category.activity ? 'primary' : 'secondary'} text-sm ${!expanded && index >= 4 && category.activity !== activity ? 'hidden sm:inline-flex' : ''}`}
            aria-pressed={activity === category.activity}
            onClick={() => onActivity(category.activity)}
          >
            {category.label}
          </button>
        ))}
        <button
          className="secondary text-sm"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? 'Fewer activities' : 'More activities'}
          <ChevronDown size={16} aria-hidden="true" className={expanded ? 'rotate-180' : ''} />
        </button>
      </div>
      <VenueResults key={activity} activity={activity} onPost={onPost} />
    </div>
  )
}

function VenueResults({ activity, onPost }: Pick<Props, 'activity' | 'onPost'>) {
  const [places, setPlaces] = useState<DiscoverableVenue[]>([])
  const [sort, setSort] = useState<VenueSort>('rating')
  const [pageToken, setPageToken] = useState<string>()
  const [nextPageToken, setNextPageToken] = useState<string>()
  const [retry, setRetry] = useState(0)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [pagesLoaded, setPagesLoaded] = useState(0)
  const category = VENUE_CATEGORIES.find((c) => c.activity === activity)!
  const sorted = useMemo(() => sortVenues(places, sort), [places, sort])

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    const timeout = setTimeout(() => controller.abort(), 12000)
    setLoading(true)
    setFailed(false)
    discoverVenues(activity, controller.signal, pageToken)
      .then((result) => {
        if (!active) return
        setPlaces((previous) => (pageToken ? [...previous, ...result.places] : result.places))
        setNextPageToken(result.nextPageToken)
        setPagesLoaded((count) => (pageToken ? count + 1 : 1))
      })
      .catch(() => {
        if (active) setFailed(true)
      })
      .finally(() => {
        clearTimeout(timeout)
        if (active) setLoading(false)
      })
    return () => {
      active = false
      clearTimeout(timeout)
      controller.abort()
    }
  }, [activity, pageToken, retry])

  return (
    <section aria-label={`${category.label} venues in Jaipur`} aria-busy={loading}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 mb-3">
        <div>
          <h2 className="text-lg sm:text-xl font-bold">{category.label} in Jaipur</h2>
          <p className="text-sm text-gray-600 mt-1">Find a place, then invite people along.</p>
        </div>
        <label className="field w-40 sm:w-auto">
          Sort places
          <select value={sort} onChange={(e) => setSort(e.target.value as VenueSort)}>
            <option value="rating">Highest rated</option>
            <option value="reviews">Most reviewed</option>
            <option value="relevance">Google relevance</option>
          </select>
        </label>
      </div>
      <p className="text-xs text-gray-600 mb-5">
        {sort === 'rating'
          ? 'Sorted by Google rating within these results.'
          : sort === 'reviews'
            ? 'Sorted by number of Google reviews within these results.'
            : 'Ordered by Google’s relevance to this activity.'}{' '}
        Check prices, timings and bookings with the venue before posting.
      </p>
      <p role="status" className="text-sm text-gray-600 mb-4">
        {loading
          ? places.length
            ? 'Loading more places…'
            : 'Finding places in Jaipur…'
          : failed
            ? ''
            : `${sorted.length} ${sorted.length === 1 ? 'place' : 'places'} found`}
      </p>
      {failed && (
        <div role="alert" className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-5">
          <h3 className="font-bold">
            {places.length ? 'More places couldn’t load' : 'Places couldn’t load'}
          </h3>
          <p className="text-sm mt-2 mb-3">
            Check your connection and try again. You can also choose a venue when posting a plan.
          </p>
          <button className="secondary" onClick={() => setRetry((n) => n + 1)}>
            Try again
          </button>
        </div>
      )}
      {!loading && !failed && sorted.length === 0 && (
        <div className="py-10 text-center">
          <h3 className="font-bold text-lg">No matching venues found</h3>
          <p className="text-gray-600 mt-2">
            Try another activity, or use “Post a plan” to choose your own meeting spot.
          </p>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {sorted.map((place) => (
          <VenueCard
            key={place.id}
            place={place}
            onPost={() => onPost(venueDraft(place, activity))}
          />
        ))}
      </div>
      {nextPageToken && pagesLoaded < 5 && !failed && (
        <div className="mt-6 text-center">
          <button
            className="secondary disabled:opacity-50"
            disabled={loading}
            onClick={() => {
              setLoading(true)
              setPageToken(nextPageToken)
            }}
          >
            {loading ? 'Loading…' : 'Show more places'}
          </button>
        </div>
      )}
      {!!sorted.length && (
        <p className="text-xs text-gray-600 mt-6">
          Listings, ratings and photos from Google Maps. Results may not include every venue in
          Jaipur.
        </p>
      )}
    </section>
  )
}

function VenueCard({ place, onPost }: { place: DiscoverableVenue; onPost: () => void }) {
  const [imageFailed, setImageFailed] = useState(false)
  const photo = place.photos?.[0]
  const image = photo ? photoUrl(photo) : null
  const mapUrl =
    safeExternalUrl(place.googleMapsUri) ??
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.displayName.text)}&query_place_id=${encodeURIComponent(place.id)}`
  const website = safeExternalUrl(place.websiteUri)
  return (
    <article className="rounded-2xl border border-gray-200 bg-white overflow-hidden flex flex-col min-w-0">
      <div className="aspect-[3/2] bg-slate-100 relative overflow-hidden shrink-0">
        {image && !imageFailed ? (
          <>
            <img
              src={image}
              alt={place.displayName.text}
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
              className="absolute inset-0 w-full h-full object-cover"
              onError={() => setImageFailed(true)}
            />
            {!!photo?.authorAttributions?.length && (
              <div className="absolute bottom-0 inset-x-0 bg-white/95 px-3 py-1 text-xs text-slate-700 break-words">
                Photo:{' '}
                {photo.authorAttributions.map((author, index) => {
                  const url = safeExternalUrl(author.uri)
                  return (
                    <span key={index}>
                      {index > 0 ? ', ' : ''}
                      {url ? (
                        <a
                          className="underline"
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {author.displayName}
                        </a>
                      ) : (
                        author.displayName
                      )}
                    </span>
                  )
                })}
              </div>
            )}
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-slate-600 text-sm">
            <ImageOff size={24} aria-hidden="true" />
            No photo available
          </div>
        )}
      </div>
      <div className="p-4 flex flex-col gap-3 flex-1">
        <h3 className="font-bold text-lg leading-snug break-words">{place.displayName.text}</h3>
        <div className="text-sm flex flex-wrap items-center gap-1.5">
          <Star size={16} className="text-amber-700" aria-hidden="true" />
          {typeof place.rating === 'number' ? (
            <>
              <span className="font-semibold">
                {place.rating.toFixed(1)}
                <span className="sr-only"> out of 5</span>
              </span>
              <span className="text-gray-600">
                ({(place.userRatingCount ?? 0).toLocaleString('en-IN')} reviews)
              </span>
            </>
          ) : (
            <span className="text-gray-600">No ratings yet</span>
          )}
          <span className="text-xs text-[#5e5e5e] whitespace-nowrap font-normal" translate="no">
            · Google Maps
          </span>
        </div>
        {place.formattedAddress && (
          <p className="text-sm text-gray-600 leading-relaxed break-words">
            {place.formattedAddress}
          </p>
        )}
        {!!place.attributions?.length && (
          <p className="text-xs text-gray-600">
            {place.attributions.map((a, index) => {
              const url = safeExternalUrl(a.providerUri)
              return (
                <span key={index}>
                  {index ? ', ' : ''}
                  {url ? (
                    <a href={url} target="_blank" rel="noopener noreferrer" className="underline">
                      {a.provider}
                    </a>
                  ) : (
                    a.provider
                  )}
                </span>
              )
            })}
          </p>
        )}
        <div className="flex flex-wrap gap-x-4 mt-auto">
          <a
            href={mapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold inline-flex items-center gap-1.5 min-h-11 underline underline-offset-4"
          >
            <MapPin size={15} aria-hidden="true" />
            View on Maps
          </a>
          {website && (
            <a
              href={website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold inline-flex items-center gap-1.5 min-h-11 underline underline-offset-4"
            >
              Website
              <ExternalLink size={14} aria-hidden="true" />
            </a>
          )}
        </div>
        <button
          className="primary w-full text-sm"
          aria-label={`Make a plan at ${place.displayName.text}`}
          onClick={onPost}
        >
          Make a plan here
        </button>
      </div>
    </article>
  )
}
