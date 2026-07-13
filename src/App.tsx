import { useCallback, useMemo, useRef, useState } from 'react'
import MapView from './components/MapView'
import GoogleMapView from './components/GoogleMapView'
import { GOOGLE_MAPS_KEY } from './lib/googleMaps'
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
import { ACTIVITIES, activityByKey, type ActivityKey, type Intent } from './types'
import { useIntents } from './hooks/useIntents'
import { useAuth } from './hooks/useAuth'

export default function App() {
  const [filter, setFilter] = useState<ActivityKey | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(true)
  const [authOpen, setAuthOpen] = useState(false)
  const [postOpen, setPostOpen] = useState(false)
  const [editIntent, setEditIntent] = useState<Intent | null>(null)
  const [templateIntent, setTemplateIntent] = useState<Intent | null>(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const [view, setView] = useState<'map' | 'explore'>('map')
  const [moreFilters, setMoreFilters] = useState(false)
  const [mapProvider, setMapProvider] = useState<'google' | 'maplibre'>(
    GOOGLE_MAPS_KEY ? 'google' : 'maplibre',
  )
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
    setTemplateIntent(null)
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
      {mapProvider === 'google' ? (
        <GoogleMapView
          intents={intents}
          selectedId={selectedId}
          onSelect={handleSelect}
          onFallback={() => setMapProvider('maplibre')}
        />
      ) : (
        <MapView intents={intents} selectedId={selectedId} onSelect={handleSelect} />
      )}

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
              <h1 className="wordmark text-xl">Plann'd</h1>
              <span className="text-xs font-medium text-gray-500 max-[430px]:hidden">
                who's in? · Jaipur
              </span>
            </div>

            <div className="flex bg-white/95 backdrop-blur rounded-2xl shadow-lg p-1 text-sm font-semibold">
              <button
                onClick={() => setView('map')}
                className={`whitespace-nowrap rounded-xl px-3 py-1.5 ${
                  view === 'map' ? 'bg-gray-900 text-white' : 'text-gray-600'
                }`}
              >
                🗺️ Map
              </button>
              <button
                onClick={() => setView('explore')}
                className={`whitespace-nowrap rounded-xl px-3 py-1.5 ${
                  view === 'explore' ? 'bg-gray-900 text-white' : 'text-gray-600'
                }`}
              >
                📋 Explore
              </button>
            </div>

            {auth.session ? (
              <div className="flex items-center bg-white/95 backdrop-blur rounded-2xl shadow-lg">
                <button
                  onClick={() => {
                    setNotifOpen(true)
                    notifications.markAllRead()
                  }}
                  className="relative pl-3 pr-2 py-2 text-base"
                  aria-label="Notifications"
                >
                  🔔
                  {notifications.unread > 0 && (
                    <span className="absolute top-0.5 right-0 min-w-[16px] h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1">
                      {notifications.unread > 9 ? '9+' : notifications.unread}
                    </span>
                  )}
                </button>
                <div className="w-px h-5 bg-gray-200" />
                <button
                  onClick={() => setProfileOpen(true)}
                  className="flex items-center gap-1.5 pl-2 pr-2.5 py-1.5 text-sm font-semibold text-gray-700"
                >
                  {auth.avatarUrl ? (
                    <img src={auth.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover" />
                  ) : (
                    <span className="text-lg">{auth.emoji}</span>
                  )}
                  <span className="max-[460px]:hidden">{auth.firstName || 'You'}</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => setAuthOpen(true)}
                className="whitespace-nowrap bg-white/95 backdrop-blur rounded-2xl shadow-lg px-3.5 py-2.5 text-sm font-semibold text-gray-700"
              >
                Sign in
              </button>
            )}
          </div>
        </div>

        {/* Activity filter: top activities + expandable grid for the rest */}
        {(() => {
          const TOP: ActivityKey[] = ['badminton', 'football', 'cricket', 'running']
          const topActivities = ACTIVITIES.filter((a) => TOP.includes(a.key))
          const moreActivities = ACTIVITIES.filter((a) => !TOP.includes(a.key))
          const hiddenActive = filter && !TOP.includes(filter)
          const chipCls = (active: boolean) =>
            `shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-semibold shadow ${
              active ? 'bg-gray-900 text-white' : 'bg-white text-gray-700'
            }`
          return (
            <div className="pointer-events-auto px-4 py-3">
              <div className="flex gap-2 overflow-x-auto [scrollbar-width:none]">
                <button
                  onClick={() => {
                    setFilter(null)
                    setMoreFilters(false)
                  }}
                  className={chipCls(filter === null)}
                >
                  All
                </button>
                {hiddenActive && (
                  <button onClick={() => setFilter(null)} className={chipCls(true)}>
                    {activityByKey(filter).emoji} {activityByKey(filter).label} ✕
                  </button>
                )}
                {topActivities.map((a) => (
                  <button
                    key={a.key}
                    onClick={() => setFilter(filter === a.key ? null : a.key)}
                    className={chipCls(filter === a.key)}
                  >
                    {a.emoji} {a.label}
                  </button>
                ))}
                <button
                  onClick={() => setMoreFilters(!moreFilters)}
                  className={chipCls(moreFilters)}
                >
                  {moreFilters ? 'Less ⌃' : 'More ⌄'}
                </button>
              </div>
              {moreFilters && (
                <div className="mt-2 bg-white/95 backdrop-blur rounded-2xl shadow-lg p-3 grid grid-cols-3 gap-2">
                  {moreActivities.map((a) => (
                    <button
                      key={a.key}
                      onClick={() => {
                        setFilter(filter === a.key ? null : a.key)
                        setMoreFilters(false)
                      }}
                      className={`whitespace-nowrap rounded-xl px-2 py-2 text-xs font-semibold ${
                        filter === a.key ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {a.emoji} {a.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })()}
      </header>

      {/* Post intent FAB */}
      <button
        onClick={openPost}
        className={`absolute z-20 right-4 w-14 h-14 rounded-full bg-gradient-to-br from-gray-900 to-indigo-700 text-white text-3xl font-light shadow-xl shadow-indigo-900/30 flex items-center justify-center hover:shadow-2xl hover:shadow-indigo-900/40 ${
          view === 'map' ? 'bottom-[calc(45%+16px)]' : 'bottom-6'
        }`}
        aria-label="Post an activity"
      >
        +
      </button>

      {/* Bottom sheet (map view only) */}
      {view === 'map' && (
      <div
        className={`absolute inset-x-0 bottom-0 z-10 bg-white rounded-t-[28px] shadow-[0_-8px_32px_rgba(0,0,0,0.18)] transition-transform duration-300 ${
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
          {source === 'loading' &&
            sorted.length === 0 &&
            [0, 1, 2].map((i) => (
              <div key={i} className="rounded-2xl border border-gray-100 p-4 animate-pulse">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gray-100" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 bg-gray-100 rounded w-3/4" />
                    <div className="h-3 bg-gray-100 rounded w-1/2" />
                    <div className="h-2.5 bg-gray-100 rounded w-2/3" />
                  </div>
                </div>
              </div>
            ))}
          {source !== 'loading' && sorted.length === 0 && (
            <div className="text-center pt-6 space-y-2">
              <p className="text-4xl">🦗</p>
              <p className="text-sm font-semibold text-gray-700">Quiet right now</p>
              <p className="text-sm text-gray-500">Someone has to go first — why not you?</p>
              <button
                onClick={openPost}
                className="mt-1 bg-gray-900 text-white rounded-xl px-5 py-2.5 text-sm font-semibold"
              >
                Post a plan 🎯
              </button>
            </div>
          )}
        </div>
      </div>
      )}

      <AuthSheet auth={auth} open={authOpen} onClose={() => setAuthOpen(false)} onSignedIn={handleSignedIn} />
      <ProfileSheet
        auth={auth}
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        onViewIntent={(i) => {
          setProfileOpen(false)
          setView('map')
          handleSelect(i.id)
        }}
        onRepost={(i) => {
          setProfileOpen(false)
          setEditIntent(null)
          setTemplateIntent(i)
          setPostOpen(true)
        }}
      />
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
        template={templateIntent}
        onClose={() => {
          setPostOpen(false)
          setEditIntent(null)
          setTemplateIntent(null)
        }}
        onPosted={() => {
          setPostOpen(false)
          setEditIntent(null)
          setTemplateIntent(null)
          refresh()
        }}
      />
    </div>
  )
}
