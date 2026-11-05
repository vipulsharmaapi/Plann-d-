import { useEffect, useState } from 'react'
import { navigate, useUrlParams } from '../lib/navigation'
import { VenueResults } from './VenueDiscovery'
import { VenueSearchForm } from './VenuePresentation'
import type { Intent, VenueDraft } from '../types'
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
  const [query, setQuery] = useState(urlQuery),
    [area, setArea] = useState(urlArea)
  useEffect(() => {
    setQuery(urlQuery)
    setArea(urlArea)
  }, [urlQuery, urlArea])
  const submitted = { query: urlQuery || 'cafés, courts and parks', area: urlArea }
  function search() {
    navigate({
      browse: 'search',
      q: query.trim() || null,
      area: area || null,
      vsort: null,
      pin: null,
      vpages: null,
    })
  }
  return (
    <div className="venue-search">
      <VenueSearchForm
        query={query}
        area={area}
        onQuery={setQuery}
        onArea={setArea}
        onSearch={search}
      />
      <VenueResults
        key={JSON.stringify(submitted)}
        search={submitted}
        onPost={onPost}
        intents={intents}
        onOpenPlan={onOpenPlan}
      />
    </div>
  )
}
