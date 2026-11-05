import Avatar from './Avatar'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Auth } from '../hooks/useAuth'
import type { Intent } from '../types'
import PlanTools from './PlanTools'
import PlanContext, { PlanExtras } from './PlanContext'
import { navigate } from '../lib/navigation'
import VenueDetails from './VenueDetails'
import { ChevronDown } from 'lucide-react'
import SafetySheet from './SafetySheet'
import ConfirmAction, { type Confirmation } from './ConfirmAction'
import Sheet from './Sheet'
import { formatTimeRange } from '../lib/time'
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
  introduction?: string | null
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
  const [joinReview, setJoinReview] = useState(false),
    [introduction, setIntroduction] = useState('')
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
        .select('id,user_id,status,introduction')
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
    onSuccess?: () => void,
  ) {
    if (busy) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const { error } = await action()
      if (error) throw error
      onSuccess?.()
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
    setJoinReview(true)
  }
  function sendRequest() {
    if (!userId) return
    void run(
      () =>
        supabase.from('join_requests').insert({
          intent_id: intent.id,
          user_id: userId,
          status: 'pending',
          introduction: introduction.trim() || null,
        }),
      undefined,
      () => {
        setJoinReview(false)
        setIntroduction('')
      },
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
  const pendingCount = requests.filter((r) => r.status === 'pending').length
  const acceptedCount = requests.filter((r) => r.status === 'accepted').length
  const available = !ended && !blocked && !(loading && userId)
  const canRequest =
    available && !isMine && !mine && !(intent.womenOnly && userId && auth.gender !== 'female')
  return (
    <div className="plan-join-section">
      <PlanContext intent={intent} onProfile={onViewProfile} />
      {mine?.status === 'accepted' && available && (
        <p className="text-sm font-semibold text-green-800">You’re in.</p>
      )}
      <div className="plan-action-row join-action">
        <div className="min-w-0 flex-1">
          {loading && userId ? (
            <p role="status" className="text-sm">
              Loading your request…
            </p>
          ) : ended ? (
            <div role="status" className="text-sm">
              <h3 className="font-semibold">
                {intent.status === 'cancelled' || cancelled
                  ? 'This plan was cancelled'
                  : 'This plan has ended'}
              </h3>
              <p className="text-gray-600 mt-1">New requests are closed.</p>
              {isMine && (
                <p className="text-gray-600 mt-1">Use Repost in your profile to plan again.</p>
              )}
            </div>
          ) : blocked ? (
            <p className="text-sm">
              This plan is unavailable because a block is in place. Manage your blocks in Help.
            </p>
          ) : isMine || mine?.status === 'accepted' ? (
            <button className="primary w-full" onClick={() => onOpenChat(intent)}>
              Open group chat
            </button>
          ) : mine?.status === 'pending' ? (
            <div className="request-sent-state">
              <p className="request-sent-label" role="status">
                Request sent
              </p>
              <p>
                Waiting for {intent.posterName} to confirm your spot. You’ll find updates in My
                plans.
              </p>
              <button className="secondary" onClick={() => navigate({ view: 'plans', p: null })}>
                View my plans
              </button>
              <button className="text-button" disabled={busy} onClick={withdraw}>
                Withdraw request
              </button>
            </div>
          ) : mine?.status === 'declined' ? (
            <p className="text-sm">
              Your request was declined or your place was released. You can explore other plans.
            </p>
          ) : intent.womenOnly && userId && auth.gender !== 'female' ? (
            <p className="text-sm">
              This is a women-only plan. Eligibility uses your profile gender. Request a correction
              in Help if needed.
            </p>
          ) : (
            <button className="primary w-full" onClick={join} disabled={busy || spots === 0}>
              {spots === 0 ? 'This plan is full' : busy ? 'Sending request…' : 'Request to join'}
            </button>
          )}
        </div>
        {canRequest && spots > 0 && (
          <p className="join-approval">
            {intent.posterName} will confirm your spot.
            {!userId ? ' Sign in when you request to join.' : ''}
          </p>
        )}
      </div>
      {error && (
        <div role="alert" className="text-sm text-red-700">
          <p>{error}</p>
          <button className="underline min-h-11" onClick={load}>
            Refresh status
          </button>
        </div>
      )}
      {message && (
        <p role="status" className="text-sm text-gray-700 break-words">
          {message}
        </p>
      )}
      {available && isMine && (
        <div className="plan-sections">
          <details className="plan-disclosure" open={pendingCount > 0}>
            <summary>
              <span>
                Requests &amp; members{' '}
                <span className="text-gray-600">
                  · {pendingCount ? `${pendingCount} waiting` : acceptedCount}
                </span>
              </span>
              <ChevronDown size={16} aria-hidden="true" />
            </summary>
            <div className="pb-4">
              {requests.length === 0 && <p className="text-sm text-gray-600">No requests yet.</p>}
              {requests.map((r) => (
                <div
                  className="flex flex-wrap items-center gap-2 py-2 border-b border-gray-100"
                  key={r.id}
                >
                  <button
                    className="flex-1 text-left underline text-sm min-w-[100px] break-words"
                    onClick={() => onViewProfile(r.user_id)}
                  >
                    <Avatar userId={r.user_id} name={r.name} size={28} /> {r.name}
                  </button>
                  {r.introduction && <p className="request-introduction">{r.introduction}</p>}
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
            </div>
          </details>
          <details className="plan-disclosure">
            <summary>
              Manage plan
              <ChevronDown size={16} aria-hidden="true" />
            </summary>
            <div className="flex flex-wrap gap-2 pb-4">
              <button className="secondary text-sm" onClick={() => onEdit(intent)}>
                Edit plan
              </button>
              <button disabled={busy} className="secondary text-sm !text-red-700" onClick={cancel}>
                Cancel plan
              </button>
            </div>
          </details>
          <PlanTools intent={intent} userId={userId} />
        </div>
      )}
      {available && !isMine && mine?.status === 'accepted' && (
        <div className="plan-sections">
          <details className="plan-disclosure">
            <summary>
              Contacts &amp; membership
              <ChevronDown size={16} aria-hidden="true" />
            </summary>
            <div className="flex flex-wrap gap-2 pb-4">
              {groupLink && (
                <a
                  className="secondary text-sm"
                  href={groupLink}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  WhatsApp group
                </a>
              )}
              {intent.userId && (
                <button className="secondary text-sm" onClick={() => contact(intent.userId!)}>
                  WhatsApp host
                </button>
              )}
              <button
                className="secondary text-sm !text-red-700"
                disabled={busy}
                onClick={withdraw}
              >
                Leave plan
              </button>
            </div>
          </details>
          <PlanTools intent={intent} userId={userId} />
        </div>
      )}
      <div className="plan-secondary-actions">
        <button className="text-button" onClick={share}>
          Share plan
        </button>
      </div>
      <PlanExtras intent={intent} />
      <details className="plan-disclosure venue-info-disclosure">
        <summary>
          About the venue
          <ChevronDown size={16} aria-hidden="true" />
        </summary>
        <VenueDetails key={intent.id} intent={intent} />
      </details>
      {!isMine && (
        <button
          className="plan-safety-action"
          onClick={() => (userId ? setSafety(true) : onRequestAuth())}
        >
          Report or block
        </button>
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
      {joinReview && (
        <Sheet title="Request to join" onClose={() => !busy && setJoinReview(false)}>
          <form
            className="join-review"
            onSubmit={(e) => {
              e.preventDefault()
              sendRequest()
            }}
          >
            <h2>Request to join</h2>
            <div className="join-summary">
              <div>
                <strong>{intent.title}</strong>
                <p>
                  {formatTimeRange(intent.startsAt, intent.endsAt)} · {intent.venueName}
                </p>
              </div>
            </div>
            <p className="dialog-intro">
              {intent.posterName} will confirm your spot. Chat opens after you’re accepted.
            </p>
            <label className="field">
              A quick hello <span className="optional">Optional</span>
              <textarea
                value={introduction}
                maxLength={500}
                rows={3}
                onChange={(e) => setIntroduction(e.target.value)}
                placeholder="Introduce yourself to the host"
              />
            </label>
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
            <button className="primary w-full mt-5" disabled={busy || spots === 0 || ended}>
              {busy ? 'Sending request…' : 'Send request'}
            </button>
          </form>
        </Sheet>
      )}
      {confirmation && (
        <ConfirmAction confirmation={confirmation} onClose={() => setConfirmation(null)} />
      )}
    </div>
  )
}
