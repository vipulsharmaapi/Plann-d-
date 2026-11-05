import { useState } from 'react'
import { Building2, CheckCircle2, Coffee, Search } from 'lucide-react'
import {
  JAIPUR_AREAS,
  photoUrl,
  safeExternalUrl,
  venueNeighbourhood,
  type DiscoverableVenue,
  type VenueSearch,
} from '../lib/venues'
import { humanDay, type Intent } from '../types'
import { formatTimeRange } from '../lib/time'

export function VenueSearchForm({
  query,
  area,
  onQuery,
  onArea,
  onSearch,
}: VenueSearch & {
  onQuery: (value: string) => void
  onArea: (value: string) => void
  onSearch: () => void
}) {
  return (
    <form
      role="search"
      aria-label="Search Jaipur venues"
      className="venue-search-form"
      onSubmit={(e) => {
        e.preventDefault()
        onSearch()
      }}
    >
      <label>
        Venue or activity
        <span className="venue-search-input">
          <input
            type="search"
            placeholder="Cafés, courts, parks…"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            maxLength={120}
            enterKeyHint="search"
          />
          <Search size={20} aria-hidden="true" />
        </span>
      </label>
      <label>
        Neighbourhood
        <select value={area} onChange={(e) => onArea(e.target.value)}>
          <option value="">All Jaipur</option>
          {area && !JAIPUR_AREAS.includes(area) && <option>{area}</option>}
          {JAIPUR_AREAS.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </label>
      <button className="primary" type="submit">
        Search venues
      </button>
    </form>
  )
}

export function VenuePhoto({
  place,
  compact = false,
}: {
  place: DiscoverableVenue
  compact?: boolean
}) {
  const photo = place.photos?.[0]
  const url = photo ? photoUrl(photo) : null
  const [failed, setFailed] = useState<string | null>(null)
  return (
    <div className={`venue-photo ${compact ? 'compact' : ''}`}>
      {url && failed !== url ? (
        <img
          src={url}
          alt=""
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          onError={() => setFailed(url)}
        />
      ) : (
        <span className="venue-photo-fallback" aria-label="No venue photo">
          <Building2 size={compact ? 26 : 40} />
        </span>
      )}
    </div>
  )
}
export function VenueCredits({ place }: { place: DiscoverableVenue }) {
  const credits = [
    ...(place.photos?.[0]?.authorAttributions ?? []).map((a) => ({
      name: `Photo: ${a.displayName}`,
      url: a.uri,
    })),
    ...(place.attributions ?? []).map((a) => ({ name: a.provider, url: a.providerUri })),
  ]
  if (!credits.length) return null
  return (
    <p className="venue-credits">
      {credits.map((credit, i) => (
        <span key={i}>
          {i > 0 ? ' · ' : ''}
          {safeExternalUrl(credit.url) ? (
            <a href={safeExternalUrl(credit.url)!} target="_blank" rel="noopener noreferrer">
              {credit.name}
            </a>
          ) : (
            credit.name
          )}
        </span>
      ))}
    </p>
  )
}
export function VenueRating({ place }: { place: DiscoverableVenue }) {
  return (
    <span className="venue-rating">
      {typeof place.rating === 'number' && (
        <>
          {place.rating.toFixed(1)}
          <span className="sr-only"> out of 5</span> ·{' '}
        </>
      )}
      {typeof place.userRatingCount === 'number' && (
        <>{place.userRatingCount.toLocaleString('en-IN')} reviews · </>
      )}
      <span translate="no">Google Maps</span>
    </span>
  )
}
export function VenueRow({
  place,
  selected,
  onSelect,
  plans,
  picker = false,
}: {
  place: DiscoverableVenue
  selected: boolean
  onSelect: () => void
  plans?: number
  picker?: boolean
}) {
  return (
    <article className={`venue-row-wrap ${selected ? 'selected' : ''}`}>
      <button
        className="venue-row"
        data-place={place.id}
        aria-pressed={selected}
        onClick={onSelect}
        type="button"
        aria-label={`Select ${place.displayName.text}${venueNeighbourhood(place) ? ` in ${venueNeighbourhood(place)}` : ''}`}
      >
        <VenuePhoto place={place} compact />
        <span className="venue-row-copy">
          <strong>{place.displayName.text}</strong>
          <span className="venue-address">
            {venueNeighbourhood(place) || place.formattedAddress || 'Jaipur'}
          </span>
          <VenueRating place={place} />
          {picker ? (
            selected && (
              <span className="venue-plan-count">
                <CheckCircle2 size={16} />
                Selected
              </span>
            )
          ) : (
            <span className="venue-plan-count">
              {plans ? `${plans} upcoming ${plans === 1 ? 'plan' : 'plans'}` : 'No upcoming plans'}
            </span>
          )}
        </span>
      </button>
      <VenueCredits place={place} />
    </article>
  )
}
export function VenuePlans({
  plans,
  onOpen,
}: {
  plans: Intent[]
  onOpen?: (plan: Intent) => void
}) {
  return (
    <section className="venue-plans">
      <h3>
        {plans.length
          ? `${plans.length} upcoming ${plans.length === 1 ? 'plan' : 'plans'} here`
          : 'No upcoming plans here yet'}
      </h3>
      {plans.map((plan) => (
        <button
          key={plan.id}
          type="button"
          onClick={() => onOpen?.(plan)}
          className="venue-plan"
          aria-label={`View plan: ${plan.title}`}
        >
          <Coffee size={20} />
          <span>
            <strong>{plan.title}</strong>
            <small>
              {humanDay(plan.date)} · {formatTimeRange(plan.startsAt, plan.endsAt)} ·{' '}
              {Math.max(0, plan.spotsNeeded - plan.spotsFilled)}{' '}
              {plan.spotsNeeded - plan.spotsFilled === 1 ? 'spot' : 'spots'} open
            </small>
            {!plan.googlePlaceId && <small>Nearby name match. Confirm the meeting point.</small>}
            <span>View plan →</span>
          </span>
        </button>
      ))}
    </section>
  )
}
