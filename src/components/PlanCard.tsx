import { useEffect, useRef, useState } from 'react'
import Avatar from './Avatar'
import PlanPhoto from './PlanPhoto'
import { humanDay, type Intent } from '../types'
import { formatTimeRange } from '../lib/time'
import { usePlanVenue } from '../hooks/usePlanVenue'

export default function PlanCard({ intent, onOpen }: { intent: Intent; onOpen: () => void }) {
  const ref = useRef<HTMLElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (!('IntersectionObserver' in window)) {
      setVisible(true)
      return
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: '200px' },
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])
  const { place, loading } = usePlanVenue(intent, visible)
  const spots = Math.max(0, intent.spotsNeeded - intent.spotsFilled)
  return (
    <article className="plan-card" ref={ref} aria-labelledby={`plan-${intent.id}`}>
      <div className="plan-card-summary">
        <PlanPhoto place={place} name={intent.venueName} loading={loading} />
        <div className="plan-card-facts">
          <h3 id={`plan-${intent.id}`}>{intent.title}</h3>
          <p className="plan-card-time">
            {humanDay(intent.date)}, {formatTimeRange(intent.startsAt, intent.endsAt)}
          </p>
          <p className="plan-card-venue">
            {intent.venueName}
            {intent.venueArea ? `, ${intent.venueArea}` : ''}
          </p>
          <p className="plan-card-spots">
            {spots ? `${spots} spot${spots === 1 ? '' : 's'} open` : 'Full'}
            {intent.womenOnly ? ' · Women only' : ''}
          </p>
        </div>
      </div>
      <div className="plan-card-footer">
        <span className="host-inline">
          <Avatar userId={intent.userId} name={intent.posterName} size={28} />
          <span>{intent.posterName} is hosting</span>
        </span>
        <button className="secondary" onClick={onOpen} aria-label={`View plan: ${intent.title}`}>
          View plan
        </button>
      </div>
    </article>
  )
}
