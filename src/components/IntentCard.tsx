import type { ReactNode } from 'react'
import { activityByKey, type Intent } from '../types'

interface Props {
  intent: Intent
  selected: boolean
  onClick: () => void
  children?: ReactNode
}

export default function IntentCard({ intent, selected, onClick, children }: Props) {
  const activity = activityByKey(intent.activity)
  const spotsLeft = intent.spotsNeeded - intent.spotsFilled

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      className={`w-full text-left rounded-2xl p-4 border transition-colors cursor-pointer ${
        selected
          ? 'border-gray-900 bg-gray-50 shadow-md'
          : 'border-gray-200 bg-white hover:border-gray-300'
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
          style={{ backgroundColor: `${activity.color}22` }}
        >
          {activity.emoji}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-gray-900 truncate">{intent.title}</p>
            {intent.womenOnly && (
              <span className="text-[10px] font-bold uppercase tracking-wide bg-pink-100 text-pink-700 rounded-full px-2 py-0.5 shrink-0">
                Women only
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 truncate">{intent.venueName}</p>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-600">
            <span className="font-medium">
              {intent.startsAt}–{intent.endsAt}
            </span>
            <span
              className={`font-semibold ${spotsLeft <= 1 ? 'text-red-600' : 'text-green-700'}`}
            >
              {spotsLeft} spot{spotsLeft === 1 ? '' : 's'} left
            </span>
            <span className="text-gray-400">
              {intent.posterName} · {intent.posterJoinCount} joins
            </span>
          </div>
        </div>
      </div>
      {selected && (
        <>
          {intent.note && <p className="mt-2 text-sm text-gray-600">{intent.note}</p>}
          <div onClick={(e) => e.stopPropagation()}>{children}</div>
        </>
      )}
    </div>
  )
}
