import type { ReactNode } from 'react'
import { formatTimeRange } from '../lib/time'
import { formatKm, haversineKm, type LatLng } from '../lib/geo'
import { humanDay, todayIST, type Intent } from '../types'
import ActivityIcon from './ActivityIcon'

interface Props {
  intent: Intent
  selected: boolean
  onClick?: () => void
  userLoc?: LatLng | null
  children?: ReactNode
}

export default function IntentCard({ intent, selected, onClick, userLoc, children }: Props) {
  const Header = onClick ? 'button' : 'div'
  const spotsLeft = intent.spotsNeeded - intent.spotsFilled

  return (
    <article
      className={`min-w-0 w-full text-left rounded-2xl p-4 border transition-all cursor-pointer ${
        selected
          ? 'border-brand-600 bg-white'
          : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
      }`}
    >
      <Header
        onClick={onClick}
        aria-expanded={onClick ? selected : undefined}
        aria-controls={`plan-${intent.id}`}
        className="flex items-start gap-3 w-full text-left"
      >
        <ActivityIcon activity={intent.activity} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start flex-wrap gap-2">
            <p className="font-bold text-gray-900 break-words">{intent.title}</p>
            {intent.womenOnly && (
              <span className="text-[10px] font-bold uppercase tracking-wide bg-pink-100 text-pink-700 rounded-full px-2 py-0.5 shrink-0">
                Women only
              </span>
            )}
          </div>
          <p className="text-[13px] text-gray-600 break-words mt-1">{intent.venueName}</p>
          {intent.venueArea && <p className="text-xs text-gray-600 mt-1">{intent.venueArea}</p>}
          <p className="text-[13px] font-semibold mt-1">
            {intent.date !== todayIST() && `${humanDay(intent.date)} · `}
            {formatTimeRange(intent.startsAt, intent.endsAt)}
          </p>
          <p className="text-xs text-gray-600 mt-1 flex flex-wrap gap-x-1">
            <span>
              {spotsLeft <= 0 ? 'Full' : `${spotsLeft} spot${spotsLeft === 1 ? '' : 's'} left`}
            </span>
            <span>· {intent.posterName}</span>
            {userLoc && <span>· {formatKm(haversineKm(userLoc, intent))}</span>}
            {intent.expectedCost != null && (
              <span>
                ·{' '}
                {intent.expectedCost === 0
                  ? 'Free'
                  : `About ₹${Number(intent.expectedCost).toLocaleString('en-IN')} each`}
              </span>
            )}
            {intent.skillLevel === 'beginner' && <span>· Beginner friendly</span>}
          </p>
        </div>
      </Header>
      {selected && (
        <>
          {intent.note && <p className="mt-2 text-sm text-gray-600">{intent.note}</p>}
          <div id={`plan-${intent.id}`}>{children}</div>
        </>
      )}
    </article>
  )
}
