import { lazy, Suspense, useMemo, useState } from 'react'
import { Search, SlidersHorizontal } from 'lucide-react'
import IntentCard from './IntentCard'
import type { IntentSource } from '../hooks/useIntents'
import { haversineKm, type LatLng } from '../lib/geo'
import {
  ACTIVITIES,
  activityByKey,
  todayIST,
  type Intent,
  type ActivityKey,
  type VenueDraft,
} from '../types'
const VenueDiscovery = lazy(() => import('./VenueDiscovery'))
const VenueSearch = lazy(() => import('./VenueSearch'))
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
  onVenuePost: (draft: VenueDraft) => void
}) {
  const [browse, setBrowse] = useState<'plans' | 'places' | 'search'>('plans')
  const [venueActivity, setVenueActivity] = useState<ActivityKey>('football')
  function findPlaces(nextActivity: ActivityKey = activity ?? venueActivity) {
    setVenueActivity(nextActivity)
    setBrowse('places')
  }
  const [query, setQuery] = useState(''),
    [day, setDay] = useState('all'),
    [filters, setFilters] = useState(false),
    [openOnly, setOpenOnly] = useState(false),
    [women, setWomen] = useState(false),
    [slot, setSlot] = useState('all'),
    [radius, setRadius] = useState(0)
  const today = todayIST(),
    tomorrow = new Date(Date.now() + 86400000).toLocaleDateString('en-CA', {
      timeZone: 'Asia/Kolkata',
    })
  const filtered = useMemo(
    () =>
      intents
        .filter(
          (i) =>
            (!activity || i.activity === activity) &&
            (!query.trim() ||
              `${i.title} ${i.venueName}`.toLowerCase().includes(query.trim().toLowerCase())) &&
            (day === 'all' || i.date === (day === 'today' ? today : tomorrow)) &&
            (!openOnly || i.spotsFilled < i.spotsNeeded) &&
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
    [intents, activity, query, day, today, tomorrow, openOnly, women, slot, radius, userLoc],
  )
  const hasFilters = !!(
    activity ||
    query ||
    day !== 'all' ||
    openOnly ||
    women ||
    slot !== 'all' ||
    radius
  )
  function clear() {
    onActivity(null)
    setQuery('')
    setDay('all')
    setOpenOnly(false)
    setWomen(false)
    setSlot('all')
    setRadius(0)
  }
  return (
    <section className="max-w-5xl mx-auto px-4 sm:px-8 py-6 sm:py-10">
      <div
        className={`flex ${browse !== 'plans' ? 'flex-row' : 'flex-col sm:flex-row'} items-start justify-between gap-4 mb-6`}
      >
        <div>
          <h1
            className={`${browse !== 'plans' ? 'text-2xl' : 'text-3xl'} sm:text-4xl font-extrabold tracking-tight`}
          >
            {browse === 'search'
              ? 'Search Jaipur.'
              : browse === 'places'
                ? 'Find a place in Jaipur.'
                : 'Make time for a plan.'}
          </h1>
          {browse === 'plans' && (
            <p className="text-gray-600 mt-3 max-w-xl">
              A game, a coffee, a little company. Find people doing what you enjoy.
            </p>
          )}
        </div>
        <button
          className={`${browse !== 'plans' ? 'secondary' : 'primary'} shrink-0 text-sm`}
          onClick={onPost}
        >
          + Post a plan
        </button>
      </div>
      <div
        className="flex gap-2 border-b border-slate-200 mb-5 pb-3"
        role="group"
        aria-label="Explore Jaipur"
      >
        <button
          className={`${browse === 'plans' ? 'primary' : 'secondary'} flex-1 sm:flex-none text-xs min-[380px]:text-sm !px-2 sm:!px-4`}
          aria-pressed={browse === 'plans'}
          onClick={() => setBrowse('plans')}
        >
          Join a plan
        </button>
        <button
          className={`${browse === 'places' ? 'primary' : 'secondary'} flex-1 sm:flex-none text-xs min-[380px]:text-sm !px-2 sm:!px-4`}
          aria-pressed={browse === 'places'}
          onClick={() => findPlaces()}
        >
          Find a place
        </button>
        <button
          className={`${browse === 'search' ? 'primary' : 'secondary'} flex-1 sm:flex-none text-xs min-[380px]:text-sm !px-2 sm:!px-4`}
          aria-label="Search venues"
          aria-pressed={browse === 'search'}
          onClick={() => setBrowse('search')}
        >
          <Search size={16} aria-hidden="true" className="hidden sm:block" />
          <span>
            Search<span className="hidden sm:inline"> venues</span>
          </span>
        </button>
      </div>
      {browse === 'search' ? (
        <Suspense fallback={<p role="status">Loading venue search…</p>}>
          <VenueSearch onPost={onVenuePost} />
        </Suspense>
      ) : browse === 'places' ? (
        <Suspense fallback={<p role="status">Loading place discovery…</p>}>
          <VenueDiscovery
            activity={venueActivity}
            onActivity={setVenueActivity}
            onPost={onVenuePost}
          />
        </Suspense>
      ) : (
        <>
          <div className="flex gap-2">
            <label className="field flex-1">
              <span className="sr-only">Search plans or neighbourhoods</span>
              <span className="relative">
                <Search size={18} className="absolute left-3 top-3.5 text-gray-500" />
                <input
                  className="!pl-10"
                  type="search"
                  placeholder="Search a plan, venue or neighbourhood"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </span>
            </label>
            <button
              className="secondary"
              aria-label="Filters"
              aria-expanded={filters}
              onClick={() => setFilters(!filters)}
            >
              <SlidersHorizontal size={18} />
              <span className="hidden sm:inline">Filters</span>
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto py-4" aria-label="Activity filters">
            <button
              className={activity === null ? 'primary text-sm' : 'secondary text-sm'}
              aria-pressed={activity === null}
              onClick={() => onActivity(null)}
            >
              All
            </button>
            {ACTIVITIES.map((a) => (
              <button
                key={a.key}
                className={`${activity === a.key ? 'primary' : 'secondary'} text-sm whitespace-nowrap`}
                aria-pressed={activity === a.key}
                onClick={() => onActivity(activity === a.key ? null : a.key)}
              >
                <span aria-hidden="true">{a.emoji}</span>
                {a.label}
              </button>
            ))}
          </div>
          {activity && (
            <button
              className="text-sm text-indigo-800 font-semibold underline underline-offset-4 mb-3 text-left"
              onClick={() => findPlaces(activity)}
            >
              Find{' '}
              {activity === 'coffee'
                ? 'cafés'
                : `${activityByKey(activity).label.toLowerCase()} venues`}{' '}
              in Jaipur to start a plan
            </button>
          )}
          <div className="flex flex-wrap items-center gap-2 mb-5" aria-label="Day filters">
            {[
              ['all', 'Upcoming'],
              ['today', 'Today'],
              ['tomorrow', 'Tomorrow'],
            ].map(([value, label]) => (
              <button
                key={value}
                className={`px-4 rounded-full text-sm font-semibold ${day === value ? 'bg-indigo-100 text-indigo-900' : 'text-gray-600 bg-white'}`}
                aria-pressed={day === value}
                onClick={() => setDay(value)}
              >
                {label}
              </button>
            ))}
            {hasFilters && (
              <button className="text-sm underline px-3 ml-auto" onClick={clear}>
                Clear filters
              </button>
            )}
          </div>
          {filters && (
            <div className="grid sm:grid-cols-2 gap-4 rounded-2xl bg-white border border-gray-200 p-4 mb-5">
              <label className="field">
                Time of day
                <select value={slot} onChange={(e) => setSlot(e.target.value)}>
                  <option value="all">Any time</option>
                  <option value="morning">Before noon</option>
                  <option value="afternoon">Noon–5 pm</option>
                  <option value="evening">After 5 pm</option>
                </select>
              </label>
              <label className="field">
                Distance
                <select
                  value={radius}
                  onChange={(e) => {
                    setRadius(+e.target.value)
                    if (+e.target.value && !userLoc) onRequestLocation()
                  }}
                >
                  <option value={0}>Anywhere in Jaipur</option>
                  <option value={3}>Within 3 km</option>
                  <option value={5}>Within 5 km</option>
                  <option value={10}>Within 10 km</option>
                </select>
              </label>
              {radius > 0 && !userLoc && (
                <p className="text-sm text-amber-800">
                  Location is needed for distance filtering. You can search by neighbourhood
                  instead.
                </p>
              )}
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={openOnly}
                  onChange={(e) => setOpenOnly(e.target.checked)}
                />
                Only plans with open spots
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={women}
                  onChange={(e) => setWomen(e.target.checked)}
                />
                Women-only plans
              </label>
            </div>
          )}
          {source === 'loading' ? (
            <div role="status" className="py-14 text-center text-gray-600">
              Loading plans…
            </div>
          ) : source === 'error' ? (
            <div role="alert" className="p-6 rounded-2xl border border-amber-200 bg-amber-50">
              <h2 className="font-bold">We couldn’t refresh the plans</h2>
              <p className="text-sm my-2">
                Check your connection and try again. Any plans shown below may be out of date.
              </p>
              <button className="secondary" onClick={onRetry}>
                Try again
              </button>
            </div>
          ) : (
            <p className="text-sm font-medium text-gray-600 mb-4" aria-live="polite">
              {filtered.length} upcoming {filtered.length === 1 ? 'plan' : 'plans'}
              {userLoc ? ' · nearest first' : ''}
            </p>
          )}
          {source === 'live' && filtered.length === 0 ? (
            <div className="text-center py-12 sm:py-16">
              <span className="text-4xl" aria-hidden="true">
                {hasFilters ? '🔎' : '🏸'}
              </span>
              <h2 className="text-xl font-bold mt-4">
                {hasFilters ? 'No plans match yet' : 'Your next plan can start here'}
              </h2>
              <p className="text-gray-600 mt-2 mb-6 max-w-md mx-auto">
                {hasFilters
                  ? 'Try another day or clear your filters to see all upcoming plans.'
                  : 'There are no upcoming plans in Jaipur right now. Pick a public meeting spot and invite people to join.'}
              </p>
              <button className="primary" onClick={hasFilters ? clear : onPost}>
                {hasFilters ? 'Clear filters' : 'Post the first plan'}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              {filtered.map((i) => (
                <IntentCard
                  key={i.id}
                  intent={i}
                  selected={false}
                  userLoc={userLoc}
                  onClick={() => onOpen(i)}
                />
              ))}
            </div>
          )}
          <p className="mt-8 text-xs text-gray-500">
            Times are shown in India Standard Time. Join requests need the host’s approval.
          </p>
        </>
      )}
    </section>
  )
}
