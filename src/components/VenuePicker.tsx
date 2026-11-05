import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, X } from 'lucide-react'
import { useVenues } from '../hooks/useVenues'
import { VenueCredits, VenueRow, VenueSearchForm } from './VenuePresentation'
import { venueDraft, type DiscoverableVenue } from '../lib/venues'
import { activityByKey, type ActivityKey, type VenueDraft } from '../types'

export default function VenuePicker({
  activity,
  currentId,
  currentName,
  area: initialArea,
  onCancel,
  onConfirm,
}: {
  activity: ActivityKey
  currentId: string | null
  currentName: string
  area: string
  onCancel: () => void
  onConfirm: (venue: VenueDraft) => void
}) {
  const [query, setQuery] = useState(currentName || activityByKey(activity).label)
  const [area, setArea] = useState(initialArea)
  const [submitted, setSubmitted] = useState({ query, area })
  const [selected, setSelected] = useState<DiscoverableVenue | null>(null)
  const initialSelection = useRef(currentId)
  const { places, state, retry, nextPageToken, loadMore } = useVenues(submitted)
  useEffect(() => {
    if (initialSelection.current && places.length) {
      setSelected(places.find((place) => place.id === initialSelection.current) ?? null)
      initialSelection.current = null
    }
  }, [places])
  return (
    <div className="venue-picker">
      <div className="dialog-head">
        <h2>Choose a venue</h2>
        <button
          type="button"
          className="icon-button"
          onClick={onCancel}
          aria-label="Close venue picker"
        >
          <X size={22} />
        </button>
      </div>
      <button type="button" className="text-button" onClick={onCancel} autoFocus>
        <ArrowLeft size={18} />
        Back to your plan
      </button>
      <p className="picker-intro">Your draft is saved while you look around.</p>
      <VenueSearchForm
        query={query}
        area={area}
        onQuery={setQuery}
        onArea={setArea}
        onSearch={() => {
          setSubmitted({ query: query.trim() || activityByKey(activity).label, area })
          setSelected(null)
          initialSelection.current = null
        }}
      />
      <h3>Choose a place for your plan</h3>
      <p role="status" className="picker-status">
        {state === 'loading'
          ? 'Finding venues…'
          : state === 'ready'
            ? `${places.length} venues found`
            : ''}
      </p>
      {state === 'error' && (
        <div role="alert" className="venue-feedback">
          <h3>Venues couldn’t load</h3>
          <p>Your plan is still saved.</p>
          <button type="button" className="secondary" onClick={retry}>
            Try again
          </button>
          <button type="button" className="text-button" onClick={onCancel}>
            Enter a venue manually
          </button>
        </div>
      )}
      {state === 'ready' && !places.length && (
        <p className="venue-feedback">No matching venues. Try another activity or neighbourhood.</p>
      )}
      <div className="picker-results">
        {places.map((place) => (
          <VenueRow
            key={place.id}
            place={place}
            selected={selected?.id === place.id}
            onSelect={() => setSelected(place)}
            picker
          />
        ))}
      </div>
      {nextPageToken && (
        <button
          type="button"
          className="secondary"
          disabled={state === 'loading'}
          onClick={loadMore}
        >
          Show more venues
        </button>
      )}
      {selected && !places.some((place) => place.id === selected.id) && (
        <VenueCredits place={selected} />
      )}
      <p className="google-attribution">Photos, ratings &amp; place details from Google Maps.</p>
      <div className="picker-actions">
        <button type="button" className="secondary" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="primary"
          disabled={!selected}
          onClick={() => selected && onConfirm(venueDraft(selected, activity, submitted.area))}
        >
          Use this venue
        </button>
      </div>
    </div>
  )
}
