import { useEffect, useMemo, useState } from 'react'
import { navigate, useUrlParams } from '../lib/navigation'
import { MapPin, Search } from 'lucide-react'
import { VenueResults } from './VenueDiscovery'
import type { VenueSearch as SearchQuery } from '../lib/venues'
import type { Intent, VenueDraft } from '../types'

const examples = [
  { query: 'Football', area: 'Mansarovar' },
  { query: 'Cafés', area: 'Vaishali Nagar' },
  { query: 'Roastery', area: '' },
]

export default function VenueSearch({
  onPost,
  intents = [],
  onOpenPlan,
}: {
  onPost: (draft: VenueDraft) => void
  intents?: Intent[]
  onOpenPlan?: (plan: Intent) => void
}) {
  const params = useUrlParams(),
    urlQuery = params.get('q') ?? '',
    urlArea = params.get('area') ?? ''
  const [query, setQuery] = useState(urlQuery)
  const [area, setArea] = useState(urlArea)
  const [editing, setEditing] = useState(!urlQuery)
  const submitted = useMemo(
    () => (urlQuery ? { query: urlQuery, area: urlArea } : null),
    [urlQuery, urlArea],
  )
  useEffect(() => {
    setQuery(urlQuery)
    setArea(urlArea)
    setEditing(!urlQuery)
  }, [urlQuery, urlArea])
  function search(next: SearchQuery) {
    const cleaned = {
      query: next.query.trim().replace(/\s+/g, ' '),
      area: next.area.trim().replace(/\s+/g, ' '),
    }
    if (!cleaned.query) return
    setQuery(cleaned.query)
    setArea(cleaned.area)
    setEditing(false)
    navigate(
      {
        browse: 'search',
        q: cleaned.query,
        area: cleaned.area || null,
        vsort: null,
        pin: null,
        vpages: null,
      },
      'push',
    )
  }
  return (
    <div>
      {submitted && !editing && (
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-4 mb-5">
          <p className="text-sm text-gray-600 break-words">
            {submitted.query}
            {submitted.area ? ` · ${submitted.area}` : ' · Jaipur'}
          </p>
          <button className="secondary shrink-0 text-sm" onClick={() => setEditing(true)}>
            Edit search
          </button>
        </div>
      )}
      <div hidden={!editing}>
        <form
          role="search"
          aria-label="Search Jaipur venues"
          onSubmit={(event) => {
            event.preventDefault()
            search({ query, area })
          }}
          className="grid sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto] items-end gap-3 mb-4"
        >
          <label className="field min-w-0">
            Venue or activity
            <input
              type="search"
              className="placeholder:text-slate-600 placeholder:opacity-100"
              placeholder="Football, cafés, Roastery…"
              required
              maxLength={120}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              enterKeyHint="search"
            />
          </label>
          <label className="field min-w-0">
            Area in Jaipur (optional)
            <span className="relative">
              <MapPin
                size={18}
                aria-hidden="true"
                className="absolute left-3 top-3.5 text-gray-500"
              />
              <input
                type="search"
                className="!pl-10 placeholder:text-slate-600 placeholder:opacity-100"
                placeholder="Neighbourhood or landmark"
                maxLength={80}
                value={area}
                onChange={(event) => setArea(event.target.value)}
                enterKeyHint="search"
              />
            </span>
          </label>
          <button type="submit" className="primary min-h-11">
            <Search size={18} aria-hidden="true" />
            Search
          </button>
        </form>
        <div
          className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-7"
          aria-label="Suggested venue searches"
        >
          <span className="text-sm text-gray-600">Try</span>
          {examples.map((example) => (
            <button
              key={example.query}
              className="text-sm text-brand-700 underline underline-offset-4 min-h-11 text-left hover:text-brand-900"
              onClick={() => search(example)}
            >
              {example.query}
              {example.area ? ` · ${example.area}` : ''}
            </button>
          ))}
        </div>
      </div>
      {submitted ? (
        <VenueResults
          key={JSON.stringify(submitted)}
          search={submitted}
          onPost={onPost}
          intents={intents}
          onOpenPlan={onOpenPlan}
        />
      ) : null}
    </div>
  )
}
