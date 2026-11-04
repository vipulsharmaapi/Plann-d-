import { useState } from 'react'
import { MapPin, Search } from 'lucide-react'
import { VenueResults } from './VenueDiscovery'
import type { VenueSearch as SearchQuery } from '../lib/venues'
import type { VenueDraft } from '../types'

const examples = [
  { query: 'Football', area: 'Mansarovar' },
  { query: 'Cafés', area: 'Vaishali Nagar' },
  { query: 'Roastery', area: '' },
]

export default function VenueSearch({ onPost }: { onPost: (draft: VenueDraft) => void }) {
  const [query, setQuery] = useState('')
  const [area, setArea] = useState('')
  const [submitted, setSubmitted] = useState<SearchQuery | null>(null)
  function search(next: SearchQuery) {
    const cleaned = {
      query: next.query.trim().replace(/\s+/g, ' '),
      area: next.area.trim().replace(/\s+/g, ' '),
    }
    if (!cleaned.query) return
    setQuery(cleaned.query)
    setArea(cleaned.area)
    setSubmitted(cleaned)
  }
  return (
    <div>
      <p className="text-gray-600 mb-5">
        Search by venue name or activity. Add a neighbourhood to find places nearby.
      </p>
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
            className="text-sm text-indigo-700 underline underline-offset-4 min-h-11 text-left hover:text-indigo-900"
            onClick={() => search(example)}
          >
            {example.query}
            {example.area ? ` · ${example.area}` : ''}
          </button>
        ))}
      </div>
      {submitted ? (
        <VenueResults key={JSON.stringify(submitted)} search={submitted} onPost={onPost} />
      ) : (
        <div className="border-t border-slate-200 pt-8 pb-10">
          <h2 className="font-bold text-xl">Know the name? Start there.</h2>
          <p className="text-gray-600 mt-2 max-w-xl">
            Or search for something you’d like to do. Compare photos, ratings and locations, then
            make a plan at your favourite spot.
          </p>
        </div>
      )}
    </div>
  )
}
