import VenueDetails from './components/VenueDetails'
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { CalendarDays, Compass, Map, Inbox, MapPin, Plus, HelpCircle, User } from 'lucide-react'
import Explore from './components/Explore'
import MyPlans from './components/MyPlans'
import NotificationsSheet from './components/NotificationsSheet'
import IntentCard from './components/IntentCard'
import JoinSection from './components/JoinSection'
import Sheet from './components/Sheet'
import { useAuth } from './hooks/useAuth'
import { INTENT_COLUMNS, rowToIntent, useIntents, type IntentRow } from './hooks/useIntents'
import { useNotifications, type AppNotification } from './hooks/useNotifications'
import { supabase } from './lib/supabase'
import { GOOGLE_MAPS_KEY } from './lib/googleMaps'
import type { LatLng } from './lib/geo'
import { humanDay, type Intent, type ActivityKey } from './types'
const MapView = lazy(() => import('./components/MapView'))
const GoogleMapView = lazy(() => import('./components/GoogleMapView'))
const AuthSheet = lazy(() => import('./components/AuthSheet'))
const PostSheet = lazy(() => import('./components/PostSheet'))
const ProfileSheet = lazy(() => import('./components/ProfileSheet'))
const ProfilePeek = lazy(() => import('./components/ProfilePeek'))
const ChatSheet = lazy(() => import('./components/ChatSheet'))
const HelpSheet = lazy(() => import('./components/HelpSheet'))
type View = 'explore' | 'map' | 'plans' | 'inbox'
export default function App() {
  const auth = useAuth(),
    { intents, source, refresh } = useIntents(auth.session?.user.id),
    notifications = useNotifications(auth.session)
  const [view, setView] = useState<View>('explore'),
    [activity, setActivity] = useState<ActivityKey | null>(null),
    [selected, setSelected] = useState<Intent | null>(null)
  const [authOpen, setAuthOpen] = useState(false),
    [postOpen, setPostOpen] = useState(false),
    [profileOpen, setProfileOpen] = useState(false),
    [helpOpen, setHelpOpen] = useState(false)
  const [editing, setEditing] = useState<Intent | null>(null),
    [template, setTemplate] = useState<Intent | null>(null),
    [peek, setPeek] = useState<string | null>(null),
    [chat, setChat] = useState<Intent | null>(null)
  const [userLoc, setUserLoc] = useState<LatLng | null>(null),
    [locating, setLocating] = useState(false),
    [notice, setNotice] = useState(''),
    [linkLoading, setLinkLoading] = useState(false)
  const [provider, setProvider] = useState(GOOGLE_MAPS_KEY ? 'google' : 'maplibre')
  const afterAuth = useRef<'post' | 'plan' | null>(null),
    deepLink = useRef(new URLSearchParams(location.search).get('p'))
  const [planKey, setPlanKey] = useState(0)
  const openPlan = useCallback((intent: Intent) => {
    setSelected(intent)
    setNotice('')
    history.replaceState(null, '', `/?p=${intent.id}`)
  }, [])
  function closePlan() {
    setSelected(null)
    history.replaceState(null, '', location.pathname)
  }
  const fetchPlan = useCallback(
    async (id: string) => {
      setLinkLoading(true)
      try {
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
          setNotice('This plan link is invalid. Browse upcoming plans below.')
          return null
        }
        const { data, error } = await supabase
          .from('intents')
          .select(INTENT_COLUMNS)
          .eq('id', id)
          .maybeSingle()
        if (error) throw error
        if (!data) {
          setNotice('This plan is no longer available. Browse upcoming plans below.')
          return null
        }
        const intent = rowToIntent(data as IntentRow)
        openPlan(intent)
        return intent
      } catch {
        setNotice('Couldn’t open this plan. Check your connection and try the link again.')
        return null
      } finally {
        setLinkLoading(false)
      }
    },
    [openPlan],
  )
  useEffect(() => {
    if (deepLink.current) {
      const id = deepLink.current
      deepLink.current = null
      fetchPlan(id)
    }
  }, [fetchPlan])
  useEffect(() => {
    setSelected((previous) =>
      previous ? (intents.find((i) => i.id === previous.id) ?? previous) : null,
    )
  }, [intents])
  const selectedId = selected?.id
  useEffect(() => {
    if (!selectedId) return
    const channel = supabase
      .channel('open-plan-' + selectedId + '-' + crypto.randomUUID())
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'intents', filter: `id=eq.${selectedId}` },
        (payload) => setSelected(rowToIntent(payload.new as IntentRow)),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [selectedId])
  useEffect(() => {
    document.title = selected
      ? `${selected.title} · ${humanDay(selected.date)} | Plann’d`
      : 'Plann’d — Find your people in Jaipur'
  }, [selected])
  useEffect(() => {
    if (
      chat &&
      notifications.items.some(
        (n) => n.intent_id === chat.id && n.type === 'chat_message' && !n.read_at,
      )
    )
      void notifications.markChatRead(chat.id)
  }, [chat, notifications])
  function signIn(action?: 'post' | 'plan') {
    afterAuth.current = action ?? null
    setAuthOpen(true)
  }
  function post() {
    setEditing(null)
    setTemplate(null)
    if (auth.session) setPostOpen(true)
    else signIn('post')
  }
  function signedIn() {
    setAuthOpen(false)
    if (afterAuth.current === 'post') setPostOpen(true)
    if (afterAuth.current === 'plan')
      setNotice('You’re signed in. Review the plan, then send your join request.')
    afterAuth.current = null
  }
  function locate() {
    if (!navigator.geolocation) {
      setNotice('Location isn’t available here. Search by venue or neighbourhood.')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setUserLoc({ lat: p.coords.latitude, lng: p.coords.longitude })
        setLocating(false)
        setNotice('Plans are now sorted by distance from you.')
      },
      () => {
        setLocating(false)
        setNotice(
          'Couldn’t get your location. You can search by venue or neighbourhood. When ready, allow location in your browser settings.',
        )
      },
      { timeout: 10000, maximumAge: 120000, enableHighAccuracy: false },
    )
  }
  async function openNotification(n: AppNotification) {
    await notifications.markRead(n.id)
    if (n.intent_id) {
      const i = await fetchPlan(n.intent_id)
      if (i && n.type === 'chat_message' && i.status !== 'cancelled') {
        setSelected(null)
        setChat(i)
      }
    }
  }
  const mapIntents = intents.filter((i) => !activity || i.activity === activity)
  const nav = [
    { key: 'explore' as View, label: 'Explore', icon: Compass },
    { key: 'map' as View, label: 'Map', icon: Map },
    { key: 'plans' as View, label: 'My plans', icon: CalendarDays },
    { key: 'inbox' as View, label: 'Inbox', icon: Inbox },
  ]
  return (
    <div className="min-h-dvh flex flex-col bg-slate-50 pb-[calc(76px+env(safe-area-inset-bottom))] sm:pb-0">
      <a className="sr-only focus:not-sr-only focus:p-3 focus:bg-white" href="#main-content">
        Skip to content
      </a>
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 h-[72px] flex items-center gap-3">
          <button
            onClick={() => setView('explore')}
            className="text-left mr-auto"
            aria-label="Plann’d home"
          >
            <span className="wordmark block text-2xl">Plann’d</span>
            <span className="block text-[10px] font-semibold text-gray-500 tracking-wider">
              JAIPUR · WHO’S IN?
            </span>
          </button>
          <nav aria-label="Main navigation" className="hidden sm:flex gap-1 mr-auto">
            {nav.map((n) => (
              <button
                key={n.key}
                onClick={() => setView(n.key)}
                className={`relative flex items-center gap-2 px-3 rounded-xl text-sm font-semibold ${view === n.key ? 'bg-indigo-50 text-indigo-800' : 'text-gray-600'}`}
                aria-current={view === n.key ? 'page' : undefined}
              >
                <n.icon size={18} />
                {n.label}
                {n.key === 'inbox' && notifications.unread > 0 && (
                  <span className="text-xs text-indigo-700">{notifications.unread}</span>
                )}
              </button>
            ))}
          </nav>
          <button
            className="secondary !p-2.5"
            disabled={locating}
            onClick={locate}
            aria-label={locating ? 'Finding your location' : 'Use my location'}
          >
            <MapPin size={19} />
          </button>
          {auth.session ? (
            <button
              className="secondary !p-2.5"
              onClick={() => setProfileOpen(true)}
              aria-label="Your profile"
            >
              <User size={19} />
            </button>
          ) : (
            <button
              className="primary !px-3 !py-2 text-sm whitespace-nowrap"
              onClick={() => signIn()}
            >
              Sign in
            </button>
          )}
        </div>
      </header>
      {notice && (
        <div
          role="status"
          className="bg-indigo-50 px-4 sm:px-8 py-3 flex items-center gap-3 text-sm"
        >
          <p className="flex-1 max-w-5xl mx-auto">{notice}</p>
          <button onClick={() => setNotice('')} aria-label="Dismiss notice" className="px-3">
            ✕
          </button>
        </div>
      )}
      <main id="main-content" className="flex-1 min-w-0">
        {view === 'explore' && (
          <Explore
            intents={intents}
            source={source}
            onOpen={openPlan}
            onPost={post}
            onRetry={refresh}
            userLoc={userLoc}
            onRequestLocation={locate}
            activity={activity}
            onActivity={setActivity}
          />
        )}
        {view === 'plans' && (
          <MyPlans
            key={`${planKey}-${auth.session?.user.id ?? 'guest'}`}
            userId={auth.session?.user.id}
            onSignIn={() => signIn()}
            onOpen={openPlan}
            onPost={post}
          />
        )}
        {view === 'inbox' && (
          <NotificationsSheet
            items={notifications.items}
            state={notifications.state}
            signedIn={!!auth.session}
            onSignIn={() => signIn()}
            onOpenNotification={openNotification}
            onRetry={notifications.refresh}
            onMarkAll={notifications.markAllRead}
          />
        )}
        {view === 'map' && (
          <section className="relative h-[calc(100dvh-148px)] sm:h-[calc(100dvh-120px)] min-h-[480px]">
            <Suspense
              fallback={
                <p role="status" className="p-8">
                  Loading the map…
                </p>
              }
            >
              {provider === 'google' ? (
                <GoogleMapView
                  intents={mapIntents}
                  selectedId={selected?.id ?? null}
                  onSelect={(id) => {
                    const i = mapIntents.find((i) => i.id === id)
                    if (i) openPlan(i)
                  }}
                  userLoc={userLoc}
                  onFallback={() => setProvider('maplibre')}
                />
              ) : (
                <MapView
                  intents={mapIntents}
                  selectedId={selected?.id ?? null}
                  onSelect={(id) => {
                    const i = mapIntents.find((i) => i.id === id)
                    if (i) openPlan(i)
                  }}
                  userLoc={userLoc}
                />
              )}
            </Suspense>
            <div className="absolute top-4 left-4 right-4 flex items-center justify-between gap-3 pointer-events-none">
              <p className="bg-white shadow rounded-xl px-4 py-3 text-sm font-semibold pointer-events-auto">
                {source === 'loading'
                  ? 'Loading plans…'
                  : source === 'error'
                    ? 'Plans could not be refreshed'
                    : `${mapIntents.length} upcoming ${mapIntents.length === 1 ? 'plan' : 'plans'}`}
              </p>
              <button className="primary pointer-events-auto" onClick={post}>
                <Plus size={18} />
                Post
              </button>
            </div>
            {mapIntents.length === 0 && source === 'live' && (
              <div className="absolute bottom-6 left-4 right-4 max-w-md mx-auto bg-white rounded-2xl shadow-lg p-5 text-center">
                <h1 className="font-bold text-lg">No upcoming plans yet</h1>
                <p className="text-sm text-gray-600 mt-2 mb-4">
                  Choose a public spot and get the first plan started.
                </p>
                <button className="primary" onClick={post}>
                  Post a plan
                </button>
              </div>
            )}
          </section>
        )}
      </main>
      <footer className="max-w-5xl w-full mx-auto px-4 sm:px-8 py-4 flex justify-between items-center text-xs text-gray-600">
        <span>Plann’d · Jaipur</span>
        <button onClick={() => setHelpOpen(true)} className="flex items-center gap-1">
          <HelpCircle size={15} />
          Help, privacy & safety
        </button>
      </footer>
      <nav
        aria-label="Mobile navigation"
        className="fixed bottom-0 inset-x-0 z-20 bg-white border-t border-gray-200 grid grid-cols-4 sm:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {nav.map((n) => (
          <button
            key={n.key}
            className={`relative min-h-[68px] flex flex-col justify-center items-center gap-1 text-[11px] font-semibold ${view === n.key ? 'text-indigo-800 bg-indigo-50' : 'text-gray-600'}`}
            aria-current={view === n.key ? 'page' : undefined}
            onClick={() => setView(n.key)}
          >
            <n.icon size={22} />
            {n.label}
            {n.key === 'inbox' && notifications.unread > 0 && (
              <span className="absolute right-4 top-2 rounded-full bg-indigo-700 text-white px-1.5 text-[10px]">
                {notifications.unread > 9 ? '9+' : notifications.unread}
              </span>
            )}
          </button>
        ))}
      </nav>
      {linkLoading && (
        <div
          role="status"
          className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-white rounded-xl shadow p-4 z-30"
        >
          Opening plan…
        </div>
      )}
      {selected && (
        <Sheet title="Plan details" onClose={closePlan}>
          <div className="p-5 pt-16">
            <IntentCard intent={selected} selected>
              <JoinSection
                intent={selected}
                auth={auth}
                onRequestAuth={() => signIn('plan')}
                onEdit={(i) => {
                  setEditing(i)
                  setTemplate(null)
                  setPostOpen(true)
                }}
                onViewProfile={setPeek}
                onOpenChat={setChat}
              />
            </IntentCard>
            <VenueDetails key={selected.id} intent={selected} />
            {selected.womenOnly && (
              <p className="text-xs text-gray-600 mt-4">
                Women-only eligibility uses self-declared gender. Plann’d does not verify identity.
              </p>
            )}
          </div>
        </Sheet>
      )}
      <Suspense
        fallback={
          <div
            role="status"
            className="fixed inset-x-4 bottom-24 bg-white p-4 shadow-xl rounded-xl z-40"
          >
            Loading…
          </div>
        }
      >
        {authOpen && (
          <AuthSheet
            auth={auth}
            open
            onClose={() => setAuthOpen(false)}
            onSignedIn={signedIn}
            onHelp={() => setHelpOpen(true)}
          />
        )}
        {postOpen && (
          <PostSheet
            open
            session={auth.session}
            firstName={auth.firstName}
            editing={editing}
            template={template}
            onClose={() => setPostOpen(false)}
            onPosted={() => {
              setPostOpen(false)
              setSelected(null)
              refresh()
              setPlanKey((k) => k + 1)
              setView('plans')
              setNotice(
                editing
                  ? 'Your plan has been updated. Members receive an inbox update.'
                  : 'Your plan is posted. Requests will appear in My plans.',
              )
            }}
          />
        )}
        {profileOpen && (
          <ProfileSheet
            key={auth.session?.user.id}
            auth={auth}
            open
            onClose={() => setProfileOpen(false)}
            onViewIntent={(i) => {
              setProfileOpen(false)
              openPlan(i)
            }}
            onRepost={(i) => {
              setProfileOpen(false)
              setEditing(null)
              setTemplate(i)
              setPostOpen(true)
            }}
          />
        )}
        {peek && <ProfilePeek userId={peek} onClose={() => setPeek(null)} />}
        {chat && (
          <ChatSheet
            key={`${chat.id}-${auth.session?.user.id}`}
            intent={chat}
            auth={auth}
            onClose={() => setChat(null)}
          />
        )}
        {helpOpen && (
          <HelpSheet userId={auth.session?.user.id} onClose={() => setHelpOpen(false)} />
        )}
      </Suspense>
    </div>
  )
}
