import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { INTENT_COLUMNS, rowToIntent, type IntentRow } from '../hooks/useIntents'
import type { Intent } from '../types'
import PlanRow from './PlanRow'
import type { SavedPlans } from '../hooks/useSavedPlans'
export default function MyPlans({
  userId,
  onSignIn,
  onOpen,
  onPost,
  saved,
}: {
  saved?: SavedPlans
  userId?: string
  onSignIn: () => void
  onOpen: (i: Intent) => void
  onPost: () => void
}) {
  const savedIds = saved?.ids
  const sequence = useRef(0)
  const [rows, setRows] = useState<{ intent: Intent; relation: string }[]>([]),
    [tab, setTab] = useState('upcoming'),
    [state, setState] = useState('loading')
  const refresh = useCallback(async () => {
    const request = ++sequence.current
    if (!userId) return
    try {
      const [own, joins] = await Promise.all([
        supabase
          .from('intents')
          .select(INTENT_COLUMNS)
          .eq('user_id', userId)
          .order('starts_at', { ascending: false })
          .limit(100),
        supabase.from('join_requests').select('status,intent_id').eq('user_id', userId),
      ])
      if (own.error || joins.error) throw own.error ?? joins.error
      const ids = [...new Set([...(joins.data ?? []).map((j) => j.intent_id), ...(savedIds ?? [])])]
      const joined = ids.length
        ? await supabase
            .from('intents')
            .select(INTENT_COLUMNS)
            .in('id', ids)
            .order('starts_at', { ascending: false })
            .limit(100)
        : { data: [], error: null }
      if (joined.error) throw joined.error
      if (request !== sequence.current) return
      setRows([
        ...(own.data ?? []).map((i) => ({
          intent: rowToIntent(i as IntentRow),
          relation: 'Hosting',
        })),
        ...(joined.data ?? [])
          .filter((i) => i.user_id !== userId)
          .map((i) => ({
            intent: rowToIntent(i as IntentRow),
            relation: joins.data?.find((j) => j.intent_id === i.id)?.status ?? 'Saved',
          })),
      ])
      setState('ready')
    } catch {
      if (request !== sequence.current) return
      setState('error')
    }
  }, [userId, savedIds])
  useEffect(() => {
    setRows([])
    setState('loading')
    refresh()
    if (!userId) return
    const c = supabase
      .channel('my-plans-' + userId + '-' + crypto.randomUUID())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'join_requests' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'intents' }, refresh)
      .subscribe()
    window.addEventListener('focus', refresh)
    return () => {
      // Invalidate pending reads when the account or saved IDs change.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      sequence.current++
      supabase.removeChannel(c)
      window.removeEventListener('focus', refresh)
    }
  }, [refresh, userId])
  const filtered = rows.filter(({ intent: i, relation: r }) => {
    const past =
      (i.endsAtIso ?? '') < new Date().toISOString() ||
      i.status === 'cancelled' ||
      i.status === 'expired'
    return tab === 'saved'
      ? !!saved?.ids.includes(i.id)
      : tab === 'past'
        ? past
        : tab === 'hosting'
          ? r === 'Hosting' && !past
          : tab === 'requests'
            ? r === 'pending' && !past
            : !past && r !== 'declined' && r !== 'Saved'
  })
  return (
    <section className="personal-plans">
      <h1>Your plans, all together.</h1>
      <p className="text-gray-600 mt-2 mb-6">
        The plans you’re hosting, joining, or saving for later.
      </p>
      {!userId ? (
        <div className="py-12 text-center">
          <p className="mb-4">Sign in to keep track of your plans.</p>
          <button className="primary" onClick={onSignIn}>
            Sign in
          </button>
        </div>
      ) : (
        <>
          <div className="date-tabs personal-tabs">
            {[
              ['upcoming', 'Upcoming'],
              ['hosting', 'Hosting'],
              ['requests', 'Requests'],
              ['saved', 'Saved'],
              ['past', 'Past & cancelled'],
            ].map(([v, l]) => (
              <button
                key={v}
                className={tab === v ? 'active' : ''}
                aria-pressed={tab === v}
                onClick={() => setTab(v)}
              >
                {l}
              </button>
            ))}
          </div>
          {saved?.error && (
            <p role="alert">
              {saved.error}{' '}
              <button className="inline-link" onClick={saved.refresh}>
                Retry saved plans
              </button>
            </p>
          )}
          {state === 'loading' ? (
            <p role="status">Loading your plans…</p>
          ) : state === 'error' ? (
            <div role="alert">
              <p>Couldn’t load your plans.</p>
              <button className="secondary mt-3" onClick={refresh}>
                Try again
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center">
              <h2 className="font-bold text-lg">No plans in this view</h2>
              <p className="text-gray-600 mt-2 mb-5">Your plans and requests will appear here.</p>
              <button className="primary" onClick={onPost}>
                Post a plan
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filtered.map(({ intent, relation }) => (
                <div key={intent.id}>
                  <p className="text-xs font-bold text-brand-800 capitalize mb-2">
                    {intent.status === 'cancelled'
                      ? 'Cancelled'
                      : relation === 'pending'
                        ? 'Waiting for approval'
                        : relation === 'accepted'
                          ? 'Joined'
                          : relation}
                  </p>
                  <PlanRow intent={intent} onClick={() => onOpen(intent)} />
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  )
}
