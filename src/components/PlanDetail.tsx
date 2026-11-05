import { ArrowLeft, Bookmark } from 'lucide-react'
import type { ReactNode } from 'react'
import { type Intent } from '../types'
import PlanPhoto from './PlanPhoto'
import { PlanVenueContext, usePlanVenue } from '../hooks/usePlanVenue'
import type { SavedPlans } from '../hooks/useSavedPlans'
export default function PlanDetail({
  intent,
  children,
  saved,
  onSave,
  onBack,
}: {
  intent: Intent
  children: ReactNode
  saved: SavedPlans
  onSave: () => void
  onBack?: () => void
}) {
  const venue = usePlanVenue(intent)
  const isSaved = saved.ids.includes(intent.id)
  return (
    <PlanVenueContext.Provider value={venue}>
      <article className="plan-detail">
        {onBack && (
          <div className="detail-top">
            <button className="text-button" onClick={onBack}>
              <ArrowLeft size={18} />
              Back to plans
            </button>
          </div>
        )}
        <div className="detail-photo">
          <PlanPhoto place={venue.place} name={intent.venueName} loading={venue.loading} />
          <button
            className={`save-button ${isSaved ? 'saved' : ''}`}
            aria-label={isSaved ? 'Unsave plan' : 'Save plan'}
            aria-pressed={isSaved}
            disabled={saved.loading || saved.busy || !!saved.error}
            onClick={onSave}
          >
            <Bookmark size={20} fill={isSaved ? 'currentColor' : 'none'} />
          </button>
        </div>
        <div className="detail-content">
          <h1 tabIndex={-1}>{intent.title}</h1>
          <p className="detail-venue">
            {intent.venueName}
            {intent.venueArea ? `, ${intent.venueArea}` : ''}
          </p>
          {intent.womenOnly && <p className="text-sm text-brand-700 mt-2">Women only</p>}
          {saved.error && (
            <p role="alert" className="text-sm mt-3">
              {saved.error}{' '}
              <button className="inline-link" onClick={saved.refresh}>
                Refresh saved plans
              </button>
            </p>
          )}
          {children}
        </div>
      </article>
    </PlanVenueContext.Provider>
  )
}
