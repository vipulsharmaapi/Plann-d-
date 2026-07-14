import { useMemo, useState } from 'react'
import IntentCard from './IntentCard'
import JoinSection from './JoinSection'
import type { Auth } from '../hooks/useAuth'
import type { LatLng } from '../lib/geo'
import { humanDay, type Intent } from '../types'

interface Props {
  intents: Intent[]
  auth: Auth
  selectedId: string | null
  onSelect: (id: string | null) => void
  onShowOnMap: (id: string) => void
  onRequestAuth: () => void
  onEdit: (intent: Intent) => void
  onViewProfile: (userId: string) => void
  onOpenChat: (intent: Intent) => void
  userLoc?: LatLng | null
}

type TimeSlot = 'all' | 'morning' | 'afternoon' | 'evening'

const slotOf = (startsAt: string): Exclude<TimeSlot, 'all'> => {
  const hour = Number(startsAt.split(':')[0])
  if (hour < 12) return 'morning'
  if (hour < 17) return 'afternoon'
  return 'evening'
}

const SLOTS: { key: TimeSlot; label: string }[] = [
  { key: 'all', label: 'Any time' },
  { key: 'morning', label: '🌅 Morning' },
  { key: 'afternoon', label: '☀️ Afternoon' },
  { key: 'evening', label: '🌙 Evening' },
]

export default function Explore({
  intents,
  auth,
  selectedId,
  onSelect,
  onShowOnMap,
  onRequestAuth,
  onEdit,
  onViewProfile,
  onOpenChat,
  userLoc,
}: Props) {
  const [slot, setSlot] = useState<TimeSlot>('all')
  const [openOnly, setOpenOnly] = useState(false)
  const [womenOnly, setWomenOnly] = useState(false)
  const [day, setDay] = useState<string | null>(null)

  const days = useMemo(() => [...new Set(intents.map((i) => i.date))].sort(), [intents])

  const filtered = useMemo(
    () =>
      intents.filter((i) => {
        if (day && i.date !== day) return false
        if (slot !== 'all' && slotOf(i.startsAt) !== slot) return false
        if (openOnly && i.spotsNeeded - i.spotsFilled <= 0) return false
        if (womenOnly && !i.womenOnly) return false
        return true
      }),
    [intents, day, slot, openOnly, womenOnly],
  )

  const toggleCls = (active: boolean) =>
    `shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold border ${
      active ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-300'
    }`

  return (
    <div className="absolute inset-0 z-10 bg-gradient-to-b from-indigo-50/70 via-gray-50 to-gray-50 flex flex-col pt-[7.5rem]">
      <div className="mx-auto w-full max-w-4xl px-4 pb-3 space-y-2">
        {days.length > 1 && (
          <div className="flex gap-2 overflow-x-auto [scrollbar-width:none]">
            <button onClick={() => setDay(null)} className={toggleCls(day === null)}>
              All days
            </button>
            {days.map((d) => (
              <button key={d} onClick={() => setDay(day === d ? null : d)} className={toggleCls(day === d)}>
                {humanDay(d)}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2 overflow-x-auto [scrollbar-width:none]">
          {SLOTS.map((s) => (
            <button key={s.key} onClick={() => setSlot(s.key)} className={toggleCls(slot === s.key)}>
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2 overflow-x-auto [scrollbar-width:none]">
          <button onClick={() => setOpenOnly(!openOnly)} className={toggleCls(openOnly)}>
            ✅ Spots open
          </button>
          <button onClick={() => setWomenOnly(!womenOnly)} className={toggleCls(womenOnly)}>
            🚺 Women only
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-24">
        <div className="mx-auto w-full max-w-4xl px-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
            {filtered.length} live plan{filtered.length === 1 ? '' : 's'}
          </p>
          <div className="grid gap-3 md:grid-cols-2 items-start">
            {filtered.map((intent) => (
              <div key={intent.id} className={intent.id === selectedId ? 'md:col-span-2' : ''}>
                <IntentCard
                  intent={intent}
                  selected={intent.id === selectedId}
                  userLoc={userLoc}
                  onClick={() => onSelect(intent.id === selectedId ? null : intent.id)}
                >
                  <JoinSection
                    intent={intent}
                    auth={auth}
                    onRequestAuth={onRequestAuth}
                    onEdit={onEdit}
                    onViewProfile={onViewProfile}
                    onOpenChat={onOpenChat}
                  />
                  <button
                    onClick={() => onShowOnMap(intent.id)}
                    className="mt-2 w-full border border-gray-200 text-gray-600 rounded-xl py-2 text-sm font-semibold hover:bg-gray-50"
                  >
                    📍 View on map
                  </button>
                </IntentCard>
              </div>
            ))}
          </div>
          {filtered.length === 0 && (
            <div className="text-center pt-16 space-y-1">
              <p className="text-3xl">🦗</p>
              <p className="text-sm text-gray-500">Nothing matches these filters right now.</p>
              <p className="text-sm text-gray-400">Loosen a filter — or post something yourself.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
