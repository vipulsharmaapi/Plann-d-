import { useCallback, useMemo, useRef, useState } from 'react'
import MapView from './components/MapView'
import IntentCard from './components/IntentCard'
import AuthSheet from './components/AuthSheet'
import PostSheet from './components/PostSheet'
import ProfileSheet from './components/ProfileSheet'
import Explore from './components/Explore'
import ProfilePeek from './components/ProfilePeek'
import ChatSheet from './components/ChatSheet'
import NotificationsSheet from './components/NotificationsSheet'
import { useNotifications, type AppNotification } from './hooks/useNotifications'
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
  const [view, setView] = useState<'map' | 'explore'>('map')
  const [peekUserId, setPeekUserId] = useState<string | null>(null)
  const [chatIntent, setChatIntent] = useState<Intent | null>(null)
  const [notifOpen, setNotifOpen] = useState(false)
  const afterAuthRef = useRef<'post' | null>(null)
  const auth = useAuth()
  const { intents: allIntents, source, refresh } = useIntents()
  const notifications = useNotifications(auth.session)

  const openNotification = (n: AppNotification) => {
    setNotifOpen(false)
    if (!n.intent_id) return
    const intent = allIntents.find((i) => i.id === n.intent_id)
    if (!intent) return // plan expired or was cancelled
    if (n.type === 'chat_message' || n.type === 'request_accepted') {
      setChatIntent(intent)
    } else {
      setView('map')
      handleSelect(intent.id)
    }
  }

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

      {view === 'explore' && (
        <Explore
          intents={intents}
          auth={auth}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onShowOnMap={(id) => {
            setView('map')
            handleSelect(id)
          }}
          onRequestAuth={() => setAuthOpen(true)}
          onEdit={(i) => {
            setEditIntent(i)
            setPostOpen(true)
          }}
          onViewProfile={setPeekUserId}
          onOpenChat={setChatIntent}
        />
      )}

      {/* Header */}
      <header className="absolute top-0 inset-x-0 z-10 pointer-events-none">
        <div className="px-4 pt-4">
          <div className="pointer-events-auto flex items-center justify-between gap-2">
            <div className="inline-flex items-baseline gap-2 bg-white/95 backdrop-blur rounded-2xl shadow-lg px-4 py-2.5">
              <h1 className="text-xl font-extrabold tracking-tight text-gray-900">Plann'd</h1>
              <span className="text-xs font-medium text-gray-500 max-[380px]:hidden">
                who's in? · Jaipur
              </span>
            </div>

            <div className="flex bg-white/95 backdrop-blur rounded-2xl shadow-lg p-1 text-sm font-semibold">
              <button
                onClick={() => setView('map')}
                className={`rounded-xl px-3 py-1.5 ${
                  view === 'map' ? 'bg-gray-900 text-white' : 'text-gray-600'
                }`}
              >
                🗺️ Map
              </button>
              <button
                onClick={() => setView('explore')}
                className={`rounded-xl px-3 py-1.5 ${
                  view === 'explore' ? 'bg-gray-900 text-white' : 'text-gray-600'
                }`}
              >
                📋 Explore
              </button>
            </div>

            {auth.session && (
              <button
                onClick={() => {
                  setNotifOpen(true)
                  notifications.markAllRead()
                }}
                className="relative bg-white/95 backdrop-blur rounded-2xl shadow-lg px-3 py-2.5 text-base"
                aria-label="Notifications"
              >
                🔔
                {notifications.unread > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1">
                    {notifications.unread > 9 ? '9+' : notifications.unread}
                  </span>
                )}
              </button>
            )}
            {auth.session ? (
              <button
                onClick={() => setProfileOpen(true)}
                className="flex items-center gap-1.5 bg-white/95 backdrop-blur rounded-2xl shadow-lg px-2.5 py-1.5 text-sm font-semibold text-gray-700"
              >
                {auth.avatarUrl ? (
                  <img src={auth.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover" />
                ) : (
                  <span className="text-lg">{auth.emoji}</span>
                )}
                <span className="max-[420px]:hidden">{auth.firstName || 'You'}</span>
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
        className={`absolute z-20 right-4 w-14 h-14 rounded-full bg-gray-900 text-white text-3xl font-light shadow-xl flex items-center justify-center active:scale-95 transition-transform ${
          view === 'map' ? 'bottom-[calc(45%+16px)]' : 'bottom-6'
        }`}
        aria-label="Post an activity"
      >
        +
      </button>

      {/* Bottom sheet (map view only) */}
      {view === 'map' && (
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
            {source === 'loading' ? 'Loading…' : `${intents.length} plan${intents.length === 1 ? '' : 's'} live`}{' '}
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
                onViewProfile={setPeekUserId}
                onOpenChat={setChatIntent}
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
      )}

      <AuthSheet auth={auth} open={authOpen} onClose={() => setAuthOpen(false)} onSignedIn={handleSignedIn} />
      <ProfileSheet auth={auth} open={profileOpen} onClose={() => setProfileOpen(false)} />
      <ProfilePeek userId={peekUserId} onClose={() => setPeekUserId(null)} />
      <ChatSheet intent={chatIntent} auth={auth} onClose={() => setChatIntent(null)} />
      <NotificationsSheet
        open={notifOpen}
        items={notifications.items}
        onClose={() => setNotifOpen(false)}
        onOpenNotification={openNotification}
      />
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
