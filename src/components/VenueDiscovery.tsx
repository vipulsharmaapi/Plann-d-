import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, List, Map } from 'lucide-react'
import { navigate, useUrlValue } from '../lib/navigation'
import { plansAtVenue } from '../lib/planDiscovery'
import { useVenues } from '../hooks/useVenues'
import {
  safeExternalUrl,
  sortVenues,
  venueDraft,
  venueActivity,
  VENUE_CATEGORIES,
  type DiscoverableVenue,
  type VenueBounds,
  type VenueSort,
  type VenueSearch,
} from '../lib/venues'
import type { ActivityKey, VenueDraft, Intent } from '../types'
import { VenueCredits, VenuePhoto, VenuePlans, VenueRating, VenueRow } from './VenuePresentation'
const VenueMap = lazy(() => import('./VenueMap'))
export { VenuePlans } from './VenuePresentation'

type Props = {
  activity?: ActivityKey
  search?: VenueSearch
  onPost: (draft: VenueDraft) => void
  intents?: Intent[]
  onOpenPlan?: (plan: Intent) => void
}
export default function VenueDiscovery(
  props: Props & { activity: ActivityKey; onActivity: (activity: ActivityKey) => void },
) {
  return (
    <>
      <div className="venue-categories" role="group" aria-label="Find places by activity">
        {VENUE_CATEGORIES.map((category) => (
          <button
            className={props.activity === category.activity ? 'primary' : 'secondary'}
            key={category.activity}
            aria-pressed={props.activity === category.activity}
            onClick={() => props.onActivity(category.activity)}
          >
            {category.label}
          </button>
        ))}
      </div>
      <VenueResults key={props.activity} {...props} />
    </>
  )
}
export function VenueResults({ activity, search, onPost, intents = [], onOpenPlan }: Props) {
  const [bounds, setBounds] = useState<VenueBounds>()
  const { places, state, retry, nextPageToken, loadMore } = useVenues(
    activity ?? search ?? null,
    bounds,
  )
  const [sortValue] = useUrlValue('vsort', 'relevance')
  const sort: VenueSort = ['rating', 'reviews'].includes(sortValue)
    ? (sortValue as VenueSort)
    : 'relevance'
  const sorted = useMemo(() => sortVenues(places, sort), [places, sort])
  const [layout, setLayout] = useUrlValue('vlayout', 'list')
  const [pin] = useUrlValue('pin')
  const selected = sorted.find((place) => place.id === pin) ?? sorted[0]
  const detailOpen = !!pin && !!selected
  const listScroll = useRef(0)
  const backRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const lastSelected = useRef<string | null>(null)
  const wasDetailOpen = useRef(detailOpen)
  useEffect(() => {
    if (detailOpen && !wasDetailOpen.current && window.innerWidth < 900) {
      requestAnimationFrame(() => {
        backRef.current?.focus()
        backRef.current?.scrollIntoView({ block: 'start' })
      })
    }
    if (!detailOpen && wasDetailOpen.current && window.innerWidth < 900)
      requestAnimationFrame(() => {
        window.scrollTo(0, listScroll.current)
        const row = [
          ...(listRef.current?.querySelectorAll<HTMLButtonElement>('button[data-place]') ?? []),
        ].find((button) => button.dataset.place === lastSelected.current)
        row?.focus({ preventScroll: true })
      })
    wasDetailOpen.current = detailOpen
  }, [detailOpen])
  function select(id: string | null) {
    listScroll.current = window.scrollY
    lastSelected.current = id
    navigate({ pin: id }, id ? 'push' : 'replace', id ? { venueDetail: true } : undefined)
  }
  function back() {
    if (history.state?.venueDetail) history.back()
    else navigate({ pin: null }, 'replace')
  }
  function post(place: DiscoverableVenue) {
    onPost(venueDraft(place, activity ?? venueActivity(place, search?.query ?? ''), search?.area))
  }
  const count = sorted.length
  return (
    <section
      className={`venue-results ${detailOpen ? 'has-venue-detail' : ''}`}
      aria-label="Venue search results"
      aria-busy={state === 'loading'}
    >
      <div className="venue-results-toolbar">
        <p role="status">
          {state === 'loading'
            ? count
              ? 'Loading more venues…'
              : 'Finding venues…'
            : state === 'error' && !count
              ? 'Venues unavailable'
              : `${count} ${count === 1 ? 'venue' : 'venues'} in Jaipur`}
        </p>
        <div className="view-switch" role="group" aria-label="Venue result view">
          <button
            className={layout !== 'map' ? 'active' : ''}
            aria-pressed={layout !== 'map'}
            onClick={() => setLayout('list')}
          >
            <List size={17} />
            List
          </button>
          <button
            className={layout === 'map' ? 'active' : ''}
            aria-pressed={layout === 'map'}
            onClick={() => setLayout('map')}
          >
            <Map size={17} />
            Map
          </button>
        </div>
      </div>
      {state === 'error' && (
        <div role="alert" className="venue-feedback">
          <h3>{count ? 'More venues couldn’t load' : 'Venues couldn’t load'}</h3>
          <p>Check your connection and try again.</p>
          <button className="secondary" onClick={retry}>
            Try again
          </button>
        </div>
      )}
      {state === 'loading' && !count && (
        <div className="venue-skeleton" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i}>
              <span />
              <span />
            </div>
          ))}
        </div>
      )}
      {state === 'ready' && !count && (
        <div className="venue-feedback">
          <h3>{bounds ? 'No venues in this area' : 'No matching venues found'}</h3>
          <p>Try another activity or neighbourhood.</p>
          {bounds && (
            <button className="secondary" onClick={() => setBounds(undefined)}>
              Search all Jaipur
            </button>
          )}
        </div>
      )}
      {!!count && (
        <div className={`venue-split ${layout === 'map' ? 'venue-map-layout' : ''}`}>
          <div ref={listRef} className="venue-list" aria-label="Venues">
            <div>
              {sorted.map((place) => (
                <VenueRow
                  key={place.id}
                  place={place}
                  selected={selected?.id === place.id}
                  onSelect={() => select(place.id)}
                  plans={plansAtVenue(intents, place.id, place).length}
                />
              ))}
            </div>
            {nextPageToken && (
              <button
                className="secondary venue-load-more"
                disabled={state === 'loading'}
                onClick={loadMore}
              >
                Show more venues
              </button>
            )}
            <p className="google-attribution">
              Photos, ratings &amp; place details from Google Maps.
            </p>
          </div>
          <div className="venue-detail-column">
            {layout === 'map' ? (
              <Suspense fallback={<p role="status">Loading venue map…</p>}>
                <VenueMap
                  places={sorted}
                  selectedId={pin || null}
                  onSelect={select}
                  onPost={post}
                  onSearchArea={(next) => {
                    setBounds(next)
                    navigate({ pin: null }, 'replace')
                  }}
                  renderPlans={(place) => (
                    <VenuePlans
                      plans={plansAtVenue(intents, place.id, place)}
                      onOpen={onOpenPlan}
                    />
                  )}
                />
              </Suspense>
            ) : (
              selected && (
                <article className="venue-detail" aria-label={selected.displayName.text}>
                  <button ref={backRef} className="text-button venue-back" onClick={back}>
                    <ArrowLeft size={18} />
                    Back to venues
                  </button>
                  <VenuePhoto key={selected.id} place={selected} />
                  <VenueCredits place={selected} />
                  <h2>{selected.displayName.text}</h2>
                  <p className="venue-detail-address">{selected.formattedAddress}</p>
                  <VenueRating place={selected} />
                  <div className="venue-detail-links">
                    <a
                      className="secondary"
                      href={
                        safeExternalUrl(selected.googleMapsUri) ??
                        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selected.displayName.text)}&query_place_id=${encodeURIComponent(selected.id)}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View on Google Maps
                    </a>
                    {safeExternalUrl(selected.websiteUri) && (
                      <a
                        className="secondary"
                        href={safeExternalUrl(selected.websiteUri)!}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Website
                      </a>
                    )}
                  </div>
                  <VenuePlans
                    plans={plansAtVenue(intents, selected.id, selected)}
                    onOpen={onOpenPlan}
                  />
                  <button className="primary venue-post" onClick={() => post(selected)}>
                    Make a plan here
                  </button>
                </article>
              )
            )}
          </div>
        </div>
      )}
    </section>
  )
}
