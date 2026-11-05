import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Auth } from '../hooks/useAuth'
import type { Intent } from '../types'
import PlanTools from './PlanTools'
import PlanContext from './PlanContext'
import SafetySheet from './SafetySheet'
import ConfirmAction, { type Confirmation } from './ConfirmAction'
interface Props {
  intent: Intent
  auth: Auth
  onRequestAuth: () => void
  onEdit: (i: Intent) => void
  onViewProfile: (id: string) => void
  onOpenChat: (i: Intent) => void
}
interface RequestRow {
  id: string
  user_id: string
  status: 'pending' | 'accepted' | 'declined'
  name?: string
}
export default function JoinSection({
  intent,
  auth,
  onRequestAuth,
  onEdit,
  onViewProfile,
  onOpenChat,
}: Props) {
  const userId = auth.session?.user.id,
    isMine = userId === intent.userId
  const [requests, setRequests] = useState<RequestRow[]>([]),
    [groupLink, setGroupLink] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [safety, setSafety] = useState(false),
    [blocked, setBlocked] = useState(false),
    [cancelled, setCancelled] = useState(false)
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
  const load = useCallback(async () => {
    if (!userId) {
      setRequests([])
      setLoading(false)
      return
    }
    try {
      let query = supabase
        .from('join_requests')
        .select('id,user_id,status')
        .eq('intent_id', intent.id)
        .order('created_at')
      if (!isMine) query = query.eq('user_id', userId)
      const { data, error } = await query
      if (error) throw error
      const rows = (data ?? []) as RequestRow[]
      if (isMine && rows.length) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id,first_name')
          .in(
            'id',
            rows.map((r) => r.user_id),
          )
        rows.forEach(
          (r) => (r.name = profiles?.find((p) => p.id === r.user_id)?.first_name || 'Member'),
        )
      }
      setRequests(rows)
      if (intent.userId && !isMine) {
        const { data, error } = await supabase.rpc('is_blocked', { p_other: intent.userId })
        if (error) throw error
        setBlocked(!!data)
      }
      if (isMine || rows.some((r) => r.user_id === userId && r.status === 'accepted')) {
        const { data } = await supabase
          .from('intent_links')
          .select('whatsapp_link')
          .eq('intent_id', intent.id)
          .maybeSingle()
        setGroupLink(data?.whatsapp_link ?? null)
      } else setGroupLink(null)
    } catch (e) {
      setError((e as { message?: string }).message ?? 'Could not load requests. Try again.')
    } finally {
      setLoading(false)
    }
  }, [userId, isMine, intent.id, intent.userId])
  useEffect(() => {
    setLoading(true)
    setError('')
    setRequests([])
    setBlocked(false)
    setCancelled(false)
    load()
    if (!userId) return
    const c = supabase
      .channel('requests-' + intent.id + '-' + userId + '-' + crypto.randomUUID())
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'join_requests',
          filter: `intent_id=eq.${intent.id}`,
        },
        load,
      )
      .subscribe()
    const timer = setInterval(load, 30000)
    window.addEventListener('focus', load)
    return () => {
      supabase.removeChannel(c)
      clearInterval(timer)
      window.removeEventListener('focus', load)
    }
  }, [load, userId, intent.id])
  async function run(
    action: () => PromiseLike<{ error: { message: string } | null }>,
    success?: string,
  ) {
    if (busy) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const { error } = await action()
      if (error) throw error
      if (success) setMessage(success)
      await load()
    } catch (e) {
      setError((e as { message?: string }).message ?? 'Could not connect. Please try again.')
    } finally {
      setBusy(false)
    }
  }
  function join() {
    if (!userId) {
      onRequestAuth()
      return
    }
    void run(() =>
      supabase
        .from('join_requests')
        .insert({ intent_id: intent.id, user_id: userId, status: 'pending' }),
    )
  }
  function respond(r: RequestRow, status: 'accepted' | 'declined') {
    void run(() =>
      supabase.rpc('respond_to_join_request', { p_request_id: r.id, p_status: status }),
    )
  }
  const mine = requests.find((r) => r.user_id === userId),
    spots = Math.max(0, intent.spotsNeeded - intent.spotsFilled)
  const ended =
    cancelled ||
    intent.status === 'cancelled' ||
    intent.status === 'expired' ||
    (!!intent.endsAtIso && Date.parse(intent.endsAtIso) <= Date.now())
  async function share() {
    const url = `${location.origin}/?p=${intent.id}`
    try {
      if (navigator.share) await navigator.share({ title: intent.title, url })
      else {
        await navigator.clipboard.writeText(url)
        setMessage('Plan link copied.')
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setMessage(`Share this link: ${url}`)
    }
  }
  async function contact(id: string) {
    setError('')
    try {
      const { data, error } = await supabase.rpc('get_match_contact', {
        p_intent_id: intent.id,
        p_user_id: id,
      })
      if (error) throw error
      if (data)
        window.open(
          `https://wa.me/${String(data).replace(/\D/g, '')}`,
          '_blank',
          'noopener,noreferrer',
        )
      else setMessage('This person has not shared a WhatsApp number. Use the group chat.')
    } catch (e) {
      setError((e as { message?: string }).message ?? 'Could not open this contact.')
    }
  }
  function cancel() {
    setConfirmation({
      title: 'Cancel this plan?',
      description: 'Members will receive an inbox update and new join requests will close.',
      label: 'Yes, cancel plan',
      action: cancelConfirmed,
    })
  }
  function cancelConfirmed() {
    void run(async () => {
      const result = await supabase
        .from('intents')
        .update({ status: 'cancelled' })
        .eq('id', intent.id)
      if (!result.error) setCancelled(true)
      return result
    }, 'Plan cancelled. Members have been notified.')
  }
  function withdraw() {
    if (!mine) return
    setConfirmation({
      title: mine.status === 'accepted' ? 'Leave this plan?' : 'Withdraw this request?',
      description:
        mine.status === 'accepted'
          ? 'Your spot will be released and chat access will end.'
          : 'The host will no longer see your pending request.',
      label: mine.status === 'accepted' ? 'Leave plan' : 'Withdraw request',
      action: () =>
        void run(
          () => supabase.from('join_requests').delete().eq('id', mine.id),
          'Request removed.',
        ),
    })
  }
  return (
    <div className="mt-4 space-y-4">
      <PlanContext intent={intent} onProfile={onViewProfile} />
      <div className="flex items-center flex-wrap gap-2 text-sm">
        <button className="secondary text-xs" onClick={share}>
          Share
        </button>
        {!isMine && (
          <button
            className="secondary text-xs"
            onClick={() => (userId ? setSafety(true) : onRequestAuth())}
          >
            Report or block
          </button>
        )}
      </div>
      {loading && userId ? (
        <p role="status" className="text-sm">
          Loading your request…
        </p>
      ) : ended ? (
        <div className="p-4 bg-gray-100 rounded-xl">
          <h3 className="font-semibold">
            {intent.status === 'cancelled' || cancelled
              ? 'This plan was cancelled'
              : 'This plan has ended'}
          </h3>
          <p className="text-sm mt-1">New requests are closed. Check Explore for upcoming plans.</p>
          {isMine && (
            <p className="text-sm mt-2">To repeat this activity, use Repost in your profile.</p>
          )}
        </div>
      ) : blocked ? (
        <p className="p-4 bg-gray-100 rounded-xl text-sm">
          This plan is unavailable because a block is in place. Manage your blocks in Help.
        </p>
      ) : isMine ? (
        <>
          <div className="flex flex-wrap gap-2">
            <button className="primary text-sm" onClick={() => onOpenChat(intent)}>
              Group chat
            </button>
            <button className="secondary text-sm" onClick={() => onEdit(intent)}>
              Edit plan
            </button>
            <button disabled={busy} className="secondary text-sm !text-red-700" onClick={cancel}>
              Cancel plan
            </button>
          </div>
          <h3 className="font-bold text-sm">
            Requests · {requests.filter((r) => r.status === 'pending').length} waiting
          </h3>
          {requests.length === 0 && (
            <p className="text-sm text-gray-600">
              No requests yet. Share the plan to invite people.
            </p>
          )}
          {requests.map((r) => (
            <div
              className="flex flex-wrap items-center gap-2 py-2 border-b border-gray-100"
              key={r.id}
            >
              <button
                className="flex-1 text-left underline text-sm min-w-[100px]"
                onClick={() => onViewProfile(r.user_id)}
              >
                {r.name}
              </button>
              {r.status === 'pending' ? (
                <>
                  <button
                    className="primary text-xs"
                    disabled={busy || spots === 0}
                    onClick={() => respond(r, 'accepted')}
                  >
                    Accept
                  </button>
                  <button
                    className="secondary text-xs"
                    disabled={busy}
                    onClick={() => respond(r, 'declined')}
                  >
                    Decline
                  </button>
                </>
              ) : r.status === 'accepted' ? (
                <>
                  <button className="secondary text-xs" onClick={() => contact(r.user_id)}>
                    WhatsApp
                  </button>
                  <button
                    className="secondary text-xs !text-red-700"
                    disabled={busy}
                    onClick={() =>
                      setConfirmation({
                        title: `Remove ${r.name}?`,
                        description: 'Their spot and chat access will be released.',
                        label: 'Remove member',
                        action: () => respond(r, 'declined'),
                      })
                    }
                  >
                    Remove
                  </button>
                </>
              ) : (
                <span className="text-xs text-gray-600">Declined</span>
              )}
            </div>
          ))}
          <PlanTools intent={intent} userId={userId} />
        </>
      ) : mine?.status === 'accepted' ? (
        <>
          <p className="font-semibold text-green-800">You’re in. See you there!</p>
          <button className="primary w-full" onClick={() => onOpenChat(intent)}>
            Open group chat
          </button>
          <div className="flex flex-wrap gap-2">
            {groupLink && (
              <a
                className="secondary text-xs"
                href={groupLink}
                target="_blank"
                rel="noopener noreferrer"
              >
                WhatsApp group ↗
              </a>
            )}
            {intent.userId && (
              <button className="secondary text-xs" onClick={() => contact(intent.userId!)}>
                WhatsApp host ↗
              </button>
            )}
          </div>
          <PlanTools intent={intent} userId={userId} />
          <button className="text-sm underline text-red-700" disabled={busy} onClick={withdraw}>
            Leave plan
          </button>
        </>
      ) : mine?.status === 'pending' ? (
        <>
          <p className="font-semibold bg-brand-50 text-brand-900 rounded-xl p-4" role="status">
            Waiting for {intent.posterName} to approve your request.
          </p>
          <button className="secondary text-sm" disabled={busy} onClick={withdraw}>
            Withdraw request
          </button>
        </>
      ) : mine?.status === 'declined' ? (
        <p className="text-sm p-4 bg-gray-100 rounded-xl">
          Your request was declined or your place was released. You can explore other upcoming
          plans.
        </p>
      ) : intent.womenOnly && userId && auth.gender !== 'female' ? (
        <p className="text-sm p-4 bg-pink-50 text-pink-900">
          This is a women-only plan. Eligibility uses your self-declared profile gender. If it is
          incorrect, request a correction in Help.
        </p>
      ) : (
        <>
          <button className="primary w-full" onClick={join} disabled={busy || spots === 0}>
            {spots === 0
              ? 'This plan is full'
              : busy
                ? 'Sending request…'
                : userId
                  ? 'Request to join'
                  : 'Sign in to request to join'}
          </button>
          <p className="text-xs text-gray-600">
            The host approves your request. Chat opens once you’re accepted.
          </p>
        </>
      )}
      {error && (
        <div role="alert" className="text-sm text-red-700">
          <p>{error}</p>
          <button className="underline" onClick={load}>
            Refresh status
          </button>
        </div>
      )}
      {message && (
        <p role="status" className="text-sm text-gray-700 break-words">
          {message}
        </p>
      )}
      {safety && userId && (
        <SafetySheet
          intent={intent}
          userId={userId}
          onClose={() => setSafety(false)}
          onBlocked={() => {
            setBlocked(true)
            load()
          }}
        />
      )}
      {confirmation && (
        <ConfirmAction confirmation={confirmation} onClose={() => setConfirmation(null)} />
      )}
    </div>
  )
}
