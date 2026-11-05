import { ArrowLeft, Bookmark } from 'lucide-react'
import type { ReactNode } from 'react'
import { activityByKey, type Intent } from '../types'
import { planArtwork } from '../lib/discovery'
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
  const isSaved = saved.ids.includes(intent.id)
  return (
    <article className={`plan-detail ${onBack ? 'mobile-detail' : ''}`}>
      {onBack && (
        <div className="detail-top">
          <button className="text-button" onClick={onBack}>
            <ArrowLeft size={18} />
            All plans
          </button>
        </div>
      )}
      <div className="detail-photo">
        <img
          src={planArtwork(intent)}
          alt={`${activityByKey(intent.activity).label} in Jaipur, illustrative image`}
        />
        <span>{activityByKey(intent.activity).label}</span>
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
      <p className="artwork-caption">Illustrative image. Venue photos below.</p>
      <div className="detail-content">
        <h2>{intent.title}</h2>
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
  )
}
