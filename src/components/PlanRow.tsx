import { humanDay, type Intent } from '../types'
import { formatTimeRange } from '../lib/time'
import { planArtwork, planGroup } from '../lib/discovery'
export default function PlanRow({
  intent,
  selected = false,
  onClick,
  relation,
}: {
  intent: Intent
  selected?: boolean
  onClick: () => void
  relation?: string
}) {
  const spots = Math.max(0, intent.spotsNeeded - intent.spotsFilled)
  return (
    <button
      className={`plan-row ${selected ? 'selected' : ''}`}
      onClick={onClick}
      aria-label={`View ${intent.title}`}
      aria-pressed={selected}
    >
      <img
        className="plan-thumb"
        src={planArtwork(intent)}
        alt={`${planGroup(intent.activity)} illustration`}
        loading="lazy"
      />
      <span className="row-copy">
        <strong>{intent.title}</strong>
        <span className="row-time">
          {humanDay(intent.date)}, {formatTimeRange(intent.startsAt, intent.endsAt)}
        </span>
        <span className="row-venue">
          {intent.venueName}
          {intent.venueArea ? `, ${intent.venueArea}` : ''}
        </span>
        <span className="row-bottom">
          <span className="host-inline">
            <span className="avatar initial" aria-hidden="true" style={{ width: 28, height: 28 }}>
              {intent.posterName.slice(0, 1)}
            </span>
            <span>{intent.posterName} is hosting</span>
          </span>
          <span className="spots">
            {relation || (spots ? `${spots} spot${spots === 1 ? '' : 's'} open` : 'Full')}
          </span>
        </span>
      </span>
    </button>
  )
}
