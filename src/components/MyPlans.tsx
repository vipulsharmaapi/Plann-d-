import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { INTENT_COLUMNS, rowToIntent, type IntentRow } from '../hooks/useIntents'
import type { Intent } from '../types'
import IntentCard from './IntentCard'
export default function MyPlans({
  userId,
  onSignIn,
  onOpen,
  onPost,
}: {
  userId?: string
  onSignIn: () => void
  onOpen: (i: Intent) => void
  onPost: () => void
}) {
  const [rows, setRows] = useState<{ intent: Intent; relation: string }[]>([]),
    [tab, setTab] = useState('upcoming'),
    [state, setState] = useState('loading')
  const refresh = useCallback(async () => {
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
      const ids = (joins.data ?? []).map((j) => j.intent_id)
      const joined = ids.length
        ? await supabase
            .from('intents')
            .select(INTENT_COLUMNS)
            .in('id', ids)
            .order('starts_at', { ascending: false })
            .limit(100)
        : { data: [], error: null }
      if (joined.error) throw joined.error
      setRows([
        ...(own.data ?? []).map((i) => ({
          intent: rowToIntent(i as IntentRow),
          relation: 'Hosting',
        })),
        ...(joined.data ?? []).map((i) => ({
          intent: rowToIntent(i as IntentRow),
          relation: joins.data?.find((j) => j.intent_id === i.id)?.status ?? 'pending',
        })),
      ])
      setState('ready')
    } catch {
      setState('error')
    }
  }, [userId])
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
      supabase.removeChannel(c)
      window.removeEventListener('focus', refresh)
    }
  }, [refresh, userId])
  const filtered = rows.filter(({ intent: i, relation: r }) => {
    const past =
      (i.endsAtIso ?? '') < new Date().toISOString() ||
      i.status === 'cancelled' ||
      i.status === 'expired'
    return tab === 'past'
      ? past
      : tab === 'hosting'
        ? r === 'Hosting' && !past
        : tab === 'requests'
          ? r === 'pending' && !past
          : !past && r !== 'declined'
  })
  return (
    <section className="max-w-4xl mx-auto px-4 sm:px-8 py-8">
      <h1 className="text-3xl font-bold">My plans</h1>
      <p className="text-gray-600 mt-2 mb-6">
        Your requests, your group, and the plans you’re hosting.
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
          <div className="flex gap-2 overflow-x-auto mb-6">
            {[
              ['upcoming', 'Upcoming'],
              ['hosting', 'Hosting'],
              ['requests', 'Requests'],
              ['past', 'Past & cancelled'],
            ].map(([v, l]) => (
              <button
                key={v}
                className={`${tab === v ? 'primary' : 'secondary'} whitespace-nowrap text-sm`}
                aria-pressed={tab === v}
                onClick={() => setTab(v)}
              >
                {l}
              </button>
            ))}
          </div>
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
                  <IntentCard intent={intent} selected={false} onClick={() => onOpen(intent)} />
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  )
}
