import { lazy, Suspense, useEffect, useRef, useMemo, useState, type ReactNode } from 'react'
import { navigate, useUrlValue } from '../lib/navigation'
import { matchesPlan } from '../lib/planDiscovery'
import { groups, planGroup, matchesDay } from '../lib/discovery'
import { Search, SlidersHorizontal, X, Plus, List, Map, MapPin } from 'lucide-react'
import PlanRow from './PlanRow'
import type { IntentSource } from '../hooks/useIntents'
import { haversineKm, type LatLng } from '../lib/geo'
import { ACTIVITIES, type Intent, type ActivityKey, type VenueDraft } from '../types'
const JaipurMap = lazy(() => import('./JaipurMap'))
const VenueDiscovery = lazy(() => import('./VenueDiscovery'))
const VenueSearch = lazy(() => import('./VenueSearch'))
function usePlanFilter(key: string, fallback = '') {
  const [value] = useUrlValue(key, fallback)
  return [value, (next: string) => navigate({ [key]: next || null, p: null }, 'replace')] as const
}
export default function Explore({
  intents,
  source,
  onOpen,
  onPost,
  onRetry,
  userLoc,
  onRequestLocation,
  activity,
  onActivity,
  onVenuePost,
  selectedId,
  renderDetail,
}: {
  intents: Intent[]
  source: IntentSource
  onOpen: (i: Intent) => void
  onPost: () => void
  onRetry: () => void
  userLoc: LatLng | null
  onRequestLocation: () => void
  activity: ActivityKey | null
  onActivity: (a: ActivityKey | null) => void
  onVenuePost: (v: VenueDraft) => void
  selectedId?: string
  renderDetail?: (i: Intent) => ReactNode
}) {
  const [venuePin] = useUrlValue('pin')
  const [venueLayout] = useUrlValue('vlayout', 'list')
  const [browseValue] = useUrlValue('browse', 'plans'),
    browse = ['search', 'places'].includes(browseValue) ? browseValue : 'plans'
  const [group, setGroup] = usePlanFilter('group', 'All plans'),
    [query, setQuery] = usePlanFilter('planq'),
    [day, setDay] = usePlanFilter('day', 'all'),
    [area, setArea] = usePlanFilter('planarea')
  const [open, setOpen] = usePlanFilter('open'),
    [women, setWomen] = usePlanFilter('women'),
    [slot, setSlot] = usePlanFilter('time', 'all'),
    [radiusValue, setRadius] = usePlanFilter('radius', '0'),
    [layout, setLayout] = useUrlValue('layout', 'list'),
    [category] = useUrlValue('category', 'football')
  const [filters, setFilters] = useState(false),
    [mapSelected, setMapSelected] = useState<string>(),
    [visited, setVisited] = useState({ search: browse === 'search', places: browse === 'places' })
  const modeScroll = useRef<Record<string, number>>({})
  const previousMode = useRef(browse)
  useEffect(() => {
    if (previousMode.current !== browse) {
      previousMode.current = browse
      requestAnimationFrame(() => window.scrollTo(0, modeScroll.current[browse] ?? 0))
    }
  }, [browse])
  const radius = [3, 5, 10].includes(Number(radiusValue)) ? Number(radiusValue) : 0
  function setBrowse(value: 'plans' | 'places' | 'search') {
    modeScroll.current[browse] = window.scrollY
    if (value !== 'plans') setVisited((v) => ({ ...v, [value]: true }))
    navigate({ browse: value === 'plans' ? null : value, p: null })
  }
  const filtered = useMemo(
    () =>
      intents
        .filter(
          (i) =>
            (!activity || i.activity === activity) &&
            (group === 'All plans' || planGroup(i.activity) === group) &&
            matchesPlan(i, query) &&
            matchesPlan(i, area) &&
            matchesDay(i.date, day) &&
            (!open || i.spotsFilled < i.spotsNeeded) &&
            (!women || i.womenOnly) &&
            (slot === 'all' ||
              (slot === 'morning'
                ? +i.startsAt.slice(0, 2) < 12
                : slot === 'afternoon'
                  ? +i.startsAt.slice(0, 2) >= 12 && +i.startsAt.slice(0, 2) < 17
                  : +i.startsAt.slice(0, 2) >= 17)) &&
            (!radius || !userLoc || haversineKm(userLoc, i) <= radius),
        )
        .sort((a, b) =>
          userLoc
            ? haversineKm(userLoc, a) - haversineKm(userLoc, b)
            : (a.startsAtIso ?? '').localeCompare(b.startsAtIso ?? ''),
        ),
    [intents, activity, group, query, area, day, open, women, slot, radius, userLoc],
  )
  const active =
    (layout === 'map'
      ? filtered.find((i) => i.id === (mapSelected || selectedId))
      : filtered.find((i) => i.id === selectedId)) ?? filtered[0]
  const hasFilters = !!(
    activity ||
    group !== 'All plans' ||
    query ||
    area ||
    day !== 'all' ||
    open ||
    women ||
    slot !== 'all' ||
    radius
  )
  function clear() {
    onActivity(null)
    navigate(
      {
        p: null,
        group: null,
        planq: null,
        planarea: null,
        day: null,
        open: null,
        women: null,
        time: null,
        radius: null,
      },
      'replace',
    )
  }
  function searchVenues() {
    setVisited((v) => ({ ...v, search: true }))
    navigate({ browse: 'search', q: query.trim() || null, area: area || null, p: null })
  }
  const venueActivity = ACTIVITIES.find((a) => a.key === category)?.key ?? 'football'
  return (
    <section
      className={`${layout === 'map' && browse === 'plans' ? 'map-mode' : ''} ${browse !== 'plans' && venuePin && venueLayout !== 'map' ? 'venue-detail-active' : ''}`}
    >
      <section className="intro jaipur-intro">
        <img className="canopy" src="/images/jaipur-panorama.webp" alt="" />
        <div className="intro-inner">
          <div>
            <h1>
              {browse === 'plans'
                ? 'Good plans. Right here in Jaipur.'
                : 'Find a place for your next plan.'}
            </h1>
            <p>
              {browse === 'plans'
                ? 'Find a place, meet a few people, make an evening of it.'
                : 'Cafés, courts and places to meet across Jaipur.'}
            </p>
          </div>
        </div>
      </section>
      <div className="discovery-modes" role="group" aria-label="Explore mode">
        <button
          className={browse === 'plans' ? 'primary' : 'secondary'}
          aria-pressed={browse === 'plans'}
          onClick={() => setBrowse('plans')}
        >
          Join plans
        </button>
        <button
          className={browse !== 'plans' ? 'primary' : 'secondary'}
          aria-pressed={browse !== 'plans'}
          onClick={() => setBrowse('search')}
        >
          Explore venues
        </button>
      </div>
      <div hidden={browse !== 'plans'}>
        <div className="plan-search-bar">
          {' '}
          {browse === 'plans' && (
            <label className="search-field">
              <Search size={20} />
              <span className="sr-only">Search plans or places</span>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search plans or places"
              />
              {query && (
                <button aria-label="Clear search" onClick={() => setQuery('')}>
                  <X size={16} />
                </button>
              )}
            </label>
          )}
        </div>
        <div className="category-bar">
          <div className="category-scroll" role="group" aria-label="Activities">
            {groups.map((c) => (
              <button
                key={c}
                className={group === c && !activity ? 'active' : ''}
                aria-pressed={group === c && !activity}
                onClick={() => {
                  onActivity(null)
                  setGroup(c)
                }}
              >
                {c}
              </button>
            ))}
          </div>
          <button
            className={`filter-button ${filters ? 'active' : ''}`}
            aria-label="Search & filters"
            aria-expanded={filters}
            onClick={() => setFilters(!filters)}
          >
            <SlidersHorizontal size={18} />
            <span>Filters</span>
          </button>
        </div>
        {filters && (
          <div className="filter-panel production-filters">
            <label>
              Neighbourhood
              <input
                value={area}
                onChange={(e) => setArea(e.target.value)}
                placeholder="All Jaipur"
              />
            </label>
            <label>
              Activity
              <select
                value={activity ?? ''}
                onChange={(e) => onActivity((e.target.value || null) as ActivityKey | null)}
              >
                <option value="">All activities</option>
                {ACTIVITIES.map((a) => (
                  <option key={a.key} value={a.key}>
                    {a.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Time
              <select value={slot} onChange={(e) => setSlot(e.target.value)}>
                <option value="all">Any time</option>
                <option value="morning">Morning</option>
                <option value="afternoon">Afternoon</option>
                <option value="evening">Evening</option>
              </select>
            </label>
            <label>
              Distance
              <select value={radius} onChange={(e) => setRadius(e.target.value)}>
                <option value="0">Anywhere in Jaipur</option>
                <option value="3">Within 3 km</option>
                <option value="5">Within 5 km</option>
                <option value="10">Within 10 km</option>
              </select>
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={!!open}
                onChange={(e) => setOpen(e.target.checked ? '1' : '')}
              />
              Only plans with open spots
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={!!women}
                onChange={(e) => setWomen(e.target.checked ? '1' : '')}
              />
              Women-only plans
            </label>
            <button className="inline-link" onClick={onRequestLocation}>
              <MapPin size={16} />
              Use my location
            </button>
            <button className="inline-link" onClick={clear}>
              Reset filters
            </button>
            <button className="inline-link" onClick={() => setBrowse('places')}>
              Browse activities
            </button>
            {radius > 0 && !userLoc && (
              <p className="text-sm">Use your location to filter by distance.</p>
            )}
          </div>
        )}
        <div className="discovery">
          <div className="toolbar">
            <div className="date-tabs" role="group" aria-label="When">
              {[
                ['all', 'Upcoming'],
                ['today', 'Today'],
                ['tomorrow', 'Tomorrow'],
                ['weekend', 'Weekend'],
              ].map(([v, l]) => (
                <button
                  key={v}
                  className={day === v ? 'active' : ''}
                  aria-pressed={day === v}
                  onClick={() => setDay(v)}
                >
                  {l}
                </button>
              ))}
            </div>
            <div className="view-switch" role="group" aria-label="Discovery view">
              <button
                aria-pressed={layout !== 'map'}
                className={layout !== 'map' ? 'active' : ''}
                onClick={() => setLayout('list')}
              >
                <List size={17} />
                List
              </button>
              <button
                aria-pressed={layout === 'map'}
                className={layout === 'map' ? 'active' : ''}
                onClick={() => setLayout('map')}
              >
                <Map size={17} />
                Map
              </button>
            </div>
          </div>
          <div className={`discovery-grid ${layout === 'map' ? 'map-view' : ''}`}>
            <section className="plans-list" aria-label="Available plans">
              <div className="list-heading">
                <span>
                  {source === 'loading'
                    ? 'Loading plans…'
                    : `${filtered.length} ${filtered.length === 1 ? 'plan' : 'plans'} to explore`}
                </span>
              </div>
              {source === 'error' ? (
                <div role="alert" className="empty-state">
                  <h2>Plans couldn’t load</h2>
                  <p>Check your connection and try again.</p>
                  <button className="secondary" onClick={onRetry}>
                    Try again
                  </button>
                </div>
              ) : source === 'loading' ? (
                <p role="status">Loading plans in Jaipur…</p>
              ) : filtered.length ? (
                filtered.map((i) => (
                  <PlanRow
                    key={i.id}
                    intent={i}
                    selected={active?.id === i.id}
                    onClick={() => {
                      setMapSelected(i.id)
                      onOpen(i)
                    }}
                  />
                ))
              ) : (
                <div className="empty-state">
                  <h2>{hasFilters ? 'No plans match yet' : 'No upcoming plans yet'}</h2>
                  <p>
                    {hasFilters
                      ? 'Try another day, activity or neighbourhood.'
                      : 'Pick a place in Jaipur and start a plan.'}
                  </p>
                  {hasFilters && (
                    <button className="secondary" onClick={clear}>
                      Clear filters
                    </button>
                  )}
                  <button className="inline-link empty-venue-link" onClick={searchVenues}>
                    Find a venue
                  </button>
                </div>
              )}
              <div className="list-footer">
                <span>Have a place in mind?</span>
                <button className="inline-link" onClick={onPost}>
                  Post a plan <Plus size={16} />
                </button>
              </div>
            </section>
            {layout === 'map' ? (
              <Suspense fallback={<p role="status">Loading Jaipur map…</p>}>
                <JaipurMap
                  plans={filtered}
                  selected={active}
                  onSelect={(p) => setMapSelected(p.id)}
                  onDetails={(p) => {
                    setLayout('list')
                    onOpen(p)
                  }}
                />
              </Suspense>
            ) : active ? (
              <div className="desktop-detail">{renderDetail?.(active)}</div>
            ) : (
              <div className="quiet-empty">
                <img src="/images/jaipur-canopy.webp" alt="" />
                <p>A little more Jaipur, together.</p>
              </div>
            )}
          </div>
        </div>
      </div>
      <div hidden={browse === 'plans'} className="venue-workspace">
        <Suspense fallback={<p role="status">Loading venues…</p>}>
          <div hidden={browse !== 'search'}>
            {(visited.search || browse === 'search') && (
              <VenueSearch onPost={onVenuePost} intents={intents} onOpenPlan={onOpen} />
            )}
          </div>
          <div hidden={browse !== 'places'}>
            {(visited.places || browse === 'places') && (
              <VenueDiscovery
                activity={venueActivity}
                onActivity={(v) => navigate({ category: v, pin: null, vpages: null }, 'replace')}
                onPost={onVenuePost}
                intents={intents}
                onOpenPlan={onOpen}
              />
            )}
          </div>
        </Suspense>
      </div>
    </section>
  )
}
