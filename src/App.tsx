import { useCallback, useMemo, useRef, useState } from 'react'
import MapView from './components/MapView'
import IntentCard from './components/IntentCard'
import AuthSheet from './components/AuthSheet'
import PostSheet from './components/PostSheet'
import ProfileSheet from './components/ProfileSheet'
import JoinSection from './components/JoinSection'
import { ACTIVITIES, type ActivityKey, type Intent } from './types'
import { useIntents } from './hooks/useIntents'
import { useAuth } from './hooks/useAuth'

export default function App() {
  const [filter, setFilter] = useState<ActivityKey | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(true)
  const [authOpen, setAuthOpen] = useState(false)
  const [postOpen, setPostOpen] = useState(false)
  const [editIntent, setEditIntent] = useState<Intent | null>(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const afterAuthRef = useRef<'post' | null>(null)
  const auth = useAuth()
  const { intents: allIntents, source, refresh } = useIntents()

  const openPost = () => {
    setEditIntent(null)
    if (auth.session) {
      setPostOpen(true)
    } else {
      afterAuthRef.current = 'post'
      setAuthOpen(true)
    }
  }

  const handleSignedIn = () => {
    setAuthOpen(false)
    if (afterAuthRef.current === 'post') setPostOpen(true)
    afterAuthRef.current = null
  }

  const intents = useMemo(
    () => (filter ? allIntents.filter((i) => i.activity === filter) : allIntents),
    [filter, allIntents],
  )

  const handleSelect = useCallback((id: string | null) => {
    setSelectedId(id)
    if (id) setSheetOpen(true)
  }, [])

  const sorted = useMemo(() => {
    if (!selectedId) return intents
    const sel = intents.find((i) => i.id === selectedId)
    return sel ? [sel, ...intents.filter((i) => i.id !== selectedId)] : intents
  }, [intents, selectedId])

  return (
    <div className="relative h-full w-full overflow-hidden bg-gray-100">
      <MapView intents={intents} selectedId={selectedId} onSelect={handleSelect} />

      {/* Header */}
      <header className="absolute top-0 inset-x-0 z-10 pointer-events-none">
        <div className="px-4 pt-4">
          <div className="pointer-events-auto flex items-center justify-between">
            <div className="inline-flex items-baseline gap-2 bg-white/95 backdrop-blur rounded-2xl shadow-lg px-4 py-2.5">
              <h1 className="text-xl font-extrabold tracking-tight text-gray-900">Plann'd</h1>
              <span className="text-xs font-medium text-gray-500">who's in? · Jaipur</span>
            </div>
            {auth.session ? (
              <button
                onClick={() => setProfileOpen(true)}
                className="bg-white/95 backdrop-blur rounded-2xl shadow-lg px-3.5 py-2.5 text-sm font-semibold text-gray-700"
              >
                {auth.firstName || 'You'} 👋
              </button>
            ) : (
              <button
                onClick={() => setAuthOpen(true)}
                className="bg-white/95 backdrop-blur rounded-2xl shadow-lg px-3.5 py-2.5 text-sm font-semibold text-gray-700"
              >
                Sign in
              </button>
            )}
          </div>
        </div>

        {/* Activity filter chips */}
        <div className="pointer-events-auto flex gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none]">
          <button
            onClick={() => setFilter(null)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold shadow ${
              filter === null ? 'bg-gray-900 text-white' : 'bg-white text-gray-700'
            }`}
          >
            All
          </button>
          {ACTIVITIES.map((a) => (
            <button
              key={a.key}
              onClick={() => setFilter(filter === a.key ? null : a.key)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold shadow ${
                filter === a.key ? 'bg-gray-900 text-white' : 'bg-white text-gray-700'
              }`}
            >
              {a.emoji} {a.label}
            </button>
          ))}
        </div>
      </header>

      {/* Post intent FAB */}
      <button
        onClick={openPost}
        className="absolute z-20 right-4 bottom-[calc(45%+16px)] w-14 h-14 rounded-full bg-gray-900 text-white text-3xl font-light shadow-xl flex items-center justify-center active:scale-95 transition-transform"
        aria-label="Post an activity"
      >
        +
      </button>

      {/* Bottom sheet */}
      <div
        className={`absolute inset-x-0 bottom-0 z-10 bg-white rounded-t-3xl shadow-[0_-4px_24px_rgba(0,0,0,0.15)] transition-transform duration-300 ${
          sheetOpen ? 'translate-y-0' : 'translate-y-[calc(100%-56px)]'
        }`}
        style={{ height: '45%' }}
      >
        <button
          className="w-full pt-3 pb-2 flex flex-col items-center gap-1.5"
          onClick={() => setSheetOpen(!sheetOpen)}
        >
          <div className="w-10 h-1 rounded-full bg-gray-300" />
          <p className="text-sm font-semibold text-gray-900">
            {source === 'loading' ? 'Loading…' : `${intents.length} happening today`}{' '}
            {filter ? `· ${ACTIVITIES.find((a) => a.key === filter)?.label}` : ''}
            {source === 'demo' && (
              <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wide bg-amber-100 text-amber-700 rounded-full px-2 py-0.5 align-middle">
                demo
              </span>
            )}
          </p>
        </button>
        <div className="h-[calc(100%-56px)] overflow-y-auto px-4 pb-6 space-y-3">
          {sorted.map((intent) => (
            <IntentCard
              key={intent.id}
              intent={intent}
              selected={intent.id === selectedId}
              onClick={() => handleSelect(intent.id === selectedId ? null : intent.id)}
            >
              <JoinSection
                intent={intent}
                auth={auth}
                onRequestAuth={() => setAuthOpen(true)}
                onEdit={(i) => {
                  setEditIntent(i)
                  setPostOpen(true)
                }}
              />
            </IntentCard>
          ))}
          {sorted.length === 0 && (
            <p className="text-center text-gray-500 text-sm pt-8">
              Nothing here yet — be the first to post 🎯
            </p>
          )}
        </div>
      </div>

      <AuthSheet auth={auth} open={authOpen} onClose={() => setAuthOpen(false)} onSignedIn={handleSignedIn} />
      <ProfileSheet auth={auth} open={profileOpen} onClose={() => setProfileOpen(false)} />
      <PostSheet
        open={postOpen}
        session={auth.session}
        firstName={auth.firstName}
        editing={editIntent}
        onClose={() => {
          setPostOpen(false)
          setEditIntent(null)
        }}
        onPosted={() => {
          setPostOpen(false)
          setEditIntent(null)
          refresh()
        }}
      />
    </div>
  )
}
