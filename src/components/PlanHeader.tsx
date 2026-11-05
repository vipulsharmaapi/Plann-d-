import { Clock3, MapPin } from 'lucide-react'
import { humanDay, type Intent } from '../types'
import { formatTimeRange } from '../lib/time'

export default function PlanHeader({ intent }: { intent: Intent }) {
  const day = humanDay(intent.date)
  const date = new Date(`${intent.date}T12:00:00+05:30`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Kolkata',
  })
  return (
    <header className="plan-detail-header">
      <h2>{intent.title}</h2>
      {intent.womenOnly && <p className="text-sm font-semibold text-brand-700">Women only</p>}
      <div className="plan-facts">
        <div>
          <Clock3 size={20} strokeWidth={1.7} aria-hidden="true" />
          <p className="font-semibold">
            <span className="block">
              {day === 'Today' || day === 'Tomorrow' ? `${day} · ${date}` : day}
            </span>
            {formatTimeRange(intent.startsAt, intent.endsAt)}
          </p>
        </div>
        <div>
          <MapPin size={20} strokeWidth={1.7} aria-hidden="true" />
          <p>
            {intent.venueName}
            {intent.venueArea && <span className="block">{intent.venueArea}</span>}
          </p>
        </div>
      </div>
    </header>
  )
}
