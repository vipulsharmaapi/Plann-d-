import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Auth } from '../hooks/useAuth'
import { activityByKey, humanDay, type Intent } from '../types'

interface Props {
  intent: Intent
  auth: Auth
  onRequestAuth: () => void
  onEdit: (intent: Intent) => void
  onViewProfile: (userId: string) => void
  onOpenChat: (intent: Intent) => void
}

interface RequestRow {
  id: string
  user_id: string
  status: 'pending' | 'accepted' | 'declined'
  requesterName?: string
}

export default function JoinSection({
  intent,
  auth,
  onRequestAuth,
  onEdit,
  onViewProfile,
  onOpenChat,
}: Props) {
  const { session } = auth
  const isMine = !!session && intent.userId === session.user.id
  const [myRequest, setMyRequest] = useState<RequestRow | null>(null)
  const [requests, setRequests] = useState<RequestRow[]>([])
  const [groupLink, setGroupLink] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Group link is readable only by participants (RLS) — fetch once accepted
  useEffect(() => {
    if (!session || myRequest?.status !== 'accepted') {
      setGroupLink(null)
      return
    }
    supabase
      .from('intent_links')
      .select('whatsapp_link')
      .eq('intent_id', intent.id)
      .maybeSingle()
      .then(({ data }) => {
        const link = data?.whatsapp_link
        setGroupLink(link && link.startsWith('https://') ? link : null)
      })
  }, [session, myRequest?.status, intent.id])

  const load = useCallback(async () => {
    if (!session) return
    if (isMine) {
      const { data } = await supabase
        .from('join_requests')
        .select('id, user_id, status')
        .eq('intent_id', intent.id)
        .order('created_at')
      const rows = (data ?? []) as RequestRow[]
      if (rows.length) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, first_name')
          .in('id', rows.map((r) => r.user_id))
        const names = new Map((profiles ?? []).map((p) => [p.id, p.first_name]))
        rows.forEach((r) => (r.requesterName = names.get(r.user_id) || 'Someone'))
      }
      setRequests(rows)
    } else {
      const { data } = await supabase
        .from('join_requests')
        .select('id, user_id, status')
        .eq('intent_id', intent.id)
        .eq('user_id', session.user.id)
        .maybeSingle()
      setMyRequest((data as RequestRow) ?? null)
    }
  }, [session, isMine, intent.id])

  useEffect(() => {
    load()
  }, [load])

  const requestJoin = async () => {
    if (!session) {
      onRequestAuth()
      return
    }
    setBusy(true)
    setError(null)
    const { error: err } = await supabase
      .from('join_requests')
      .insert({ intent_id: intent.id, user_id: session.user.id })
    setBusy(false)
    if (err) setError(err.message)
    else load()
  }

  const respond = async (req: RequestRow, status: 'accepted' | 'declined') => {
    setBusy(true)
    const wasAccepted = req.status === 'accepted'
    const { error: err } = await supabase
      .from('join_requests')
      .update({ status })
      .eq('id', req.id)
    if (!err && status === 'accepted') {
      await supabase
        .from('intents')
        .update({ spots_filled: intent.spotsFilled + 1 })
        .eq('id', intent.id)
    }
    if (!err && wasAccepted && status === 'declined') {
      await supabase
        .from('intents')
        .update({ spots_filled: Math.max(0, intent.spotsFilled - 1) })
        .eq('id', intent.id)
    }
    setBusy(false)
    if (err) setError(err.message)
    else load()
  }

  const removeJoiner = (req: RequestRow) => {
    if (
      !confirm(
        `Remove ${req.requesterName || 'them'} from this plan? They lose access to the chat and get their spot released.`,
      )
    )
      return
    respond(req, 'declined')
  }

  const messageUser = async (targetUserId: string, targetName: string) => {
    const { data, error: err } = await supabase.rpc('get_match_contact', {
      p_intent_id: intent.id,
      p_user_id: targetUserId,
    })
    if (err) {
      setError(err.message)
      return
    }
    if (data) {
      window.open(`https://wa.me/${String(data).replace(/\D/g, '')}`, '_blank')
    } else {
      alert(`${targetName} hasn't added a WhatsApp number yet.`)
    }
  }

  const cancelIntent = async () => {
    if (!confirm('Cancel this post? People who joined will see it disappear.')) return
    setBusy(true)
    const { error: err } = await supabase
      .from('intents')
      .update({ status: 'cancelled' })
      .eq('id', intent.id)
    setBusy(false)
    if (err) setError(err.message)
  }

  const spotsLeft = intent.spotsNeeded - intent.spotsFilled

  if (isMine) {
    return (
      <div className="mt-3 space-y-2">
        <div className="flex items-center gap-2">
          <p className="flex-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Your post · {requests.filter((r) => r.status === 'pending').length} pending
          </p>
          <button
            onClick={() => onOpenChat(intent)}
            className="bg-gray-900 text-white rounded-lg px-3 py-1.5 text-xs font-semibold"
          >
            💬 Chat
          </button>
          <button
            disabled={busy}
            onClick={() => onEdit(intent)}
            className="bg-gray-100 text-gray-700 rounded-lg px-3 py-1.5 text-xs font-semibold"
          >
            ✏️ Edit
          </button>
          <button
            disabled={busy}
            onClick={cancelIntent}
            className="bg-red-50 text-red-600 rounded-lg px-3 py-1.5 text-xs font-semibold"
          >
            Cancel post
          </button>
        </div>
        {requests.length === 0 && (
          <p className="text-sm text-gray-500">No requests yet — hang tight 🤞</p>
        )}
        {requests.map((r) => (
          <div key={r.id} className="flex items-center gap-2 text-sm">
            <button
              onClick={() => onViewProfile(r.user_id)}
              className="flex-1 text-left font-medium text-gray-800 underline decoration-gray-300 underline-offset-2"
            >
              {r.requesterName}
            </button>
            {r.status === 'pending' ? (
              <>
                <button
                  disabled={busy}
                  onClick={() => respond(r, 'accepted')}
                  className="bg-gray-900 text-white rounded-lg px-3 py-1.5 text-xs font-semibold"
                >
                  Accept
                </button>
                <button
                  disabled={busy}
                  onClick={() => respond(r, 'declined')}
                  className="bg-gray-100 text-gray-600 rounded-lg px-3 py-1.5 text-xs font-semibold"
                >
                  Decline
                </button>
              </>
            ) : r.status === 'accepted' ? (
              <>
                <button
                  disabled={busy}
                  onClick={() => messageUser(r.user_id, r.requesterName || 'They')}
                  className="bg-green-50 text-green-700 border border-green-200 rounded-lg px-3 py-1.5 text-xs font-semibold"
                >
                  WhatsApp ↗
                </button>
                <button
                  disabled={busy}
                  onClick={() => removeJoiner(r)}
                  className="bg-red-50 text-red-600 rounded-lg px-3 py-1.5 text-xs font-semibold"
                >
                  Remove
                </button>
              </>
            ) : (
              <span className="text-xs font-semibold text-gray-400">declined</span>
            )}
          </div>
        ))}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    )
  }

  const shareIntent = async () => {
    const url = `${location.origin}/?p=${intent.id}`
    const text = `${activityByKey(intent.activity).emoji} ${intent.title} — ${humanDay(intent.date)} ${intent.startsAt} at ${intent.venueName}. Who's in?`
    if (navigator.share) {
      try {
        await navigator.share({ title: "Plann'd", text, url })
      } catch {
        /* user dismissed the share sheet */
      }
    } else {
      try {
        await navigator.clipboard.writeText(`${text} ${url}`)
        alert('Link copied — paste it anywhere!')
      } catch {
        prompt('Copy this link:', `${text} ${url}`)
      }
    }
  }

  const withdrawRequest = async (label: string) => {
    if (!myRequest) return
    if (!confirm(label)) return
    setBusy(true)
    const { error: err } = await supabase.from('join_requests').delete().eq('id', myRequest.id)
    setBusy(false)
    if (err) setError(err.message)
    else load()
  }

  const reportIntent = async () => {
    if (!session) {
      onRequestAuth()
      return
    }
    const reason = prompt('What’s wrong with this post?')
    if (!reason?.trim()) return
    const { error: err } = await supabase
      .from('reports')
      .insert({ reporter_id: session.user.id, intent_id: intent.id, reason: reason.trim() })
    if (err) setError(err.message)
    else alert('Reported — thanks for keeping Plann’d safe. 🙏')
  }

  const posterProfileRow = (
    <div className="flex items-center text-xs text-gray-500">
      {intent.userId ? (
        <button onClick={() => onViewProfile(intent.userId!)} className="flex-1 text-left">
          Posted by{' '}
          <span className="font-semibold text-gray-700 underline decoration-gray-300 underline-offset-2">
            {intent.posterName}
          </span>{' '}
          — view profile
        </button>
      ) : (
        <span className="flex-1" />
      )}
      <button onClick={shareIntent} className="text-gray-500 hover:text-gray-900 shrink-0 mr-3 font-semibold">
        ↗ Share
      </button>
      <button onClick={reportIntent} className="text-gray-400 hover:text-red-500 shrink-0">
        ⚠️ Report
      </button>
    </div>
  )

  if (myRequest?.status === 'accepted') {
    return (
      <div className="mt-3 space-y-2">
        <p className="text-sm font-semibold text-green-700">You're in! 🎉</p>
        {posterProfileRow}
        <button
          onClick={() => onOpenChat(intent)}
          className="w-full bg-gray-900 text-white rounded-xl py-2.5 text-sm font-semibold"
        >
          💬 Open group chat
        </button>
        <div className="flex gap-2">
          {groupLink && (
            <a
              href={groupLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 text-center bg-green-50 text-green-700 border border-green-200 rounded-xl py-2 text-xs font-semibold"
            >
              WhatsApp group ↗
            </a>
          )}
          {intent.userId && (
            <button
              onClick={() => messageUser(intent.userId!, intent.posterName)}
              className="flex-1 text-center bg-green-50 text-green-700 border border-green-200 rounded-xl py-2 text-xs font-semibold"
            >
              WhatsApp {intent.posterName} ↗
            </button>
          )}
        </div>
        <button
          disabled={busy}
          onClick={() =>
            withdrawRequest("Leave this plan? Your spot opens up and you'll lose the chat.")
          }
          className="w-full text-center text-xs font-semibold text-gray-400 hover:text-red-500"
        >
          Leave plan
        </button>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    )
  }

  if (myRequest?.status === 'pending') {
    return (
      <div className="mt-3 space-y-2">
        {posterProfileRow}
        <p className="text-center text-sm font-semibold text-gray-500 bg-gray-100 rounded-xl py-2.5">
          Requested — waiting for {intent.posterName} ⏳
        </p>
        <button
          disabled={busy}
          onClick={() => withdrawRequest('Withdraw your request?')}
          className="w-full text-center text-xs font-semibold text-gray-400 hover:text-gray-600"
        >
          Withdraw request
        </button>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    )
  }

  if (myRequest?.status === 'declined') {
    return (
      <p className="mt-3 text-center text-sm font-semibold text-gray-400 bg-gray-50 rounded-xl py-2.5">
        This one didn't work out — plenty more on the map
      </p>
    )
  }

  // Women-only gate (also enforced by RLS server-side). Signed-out users
  // still get the sign-in flow first — we can't know their gender yet.
  const womenBlocked = intent.womenOnly && !!session && auth.gender !== 'female'

  if (womenBlocked) {
    return (
      <div className="mt-3 space-y-2">
        {posterProfileRow}
        <p className="text-center text-sm font-semibold text-pink-700 bg-pink-50 rounded-xl py-2.5">
          🚺 Women-only plan
          {auth.gender === null && (
            <span className="block text-xs font-normal text-pink-600 mt-0.5">
              Set your gender in your profile if this should be open to you.
            </span>
          )}
        </p>
      </div>
    )
  }

  return (
    <div className="mt-3 space-y-2">
      {posterProfileRow}
      <button
        onClick={requestJoin}
        disabled={busy || spotsLeft <= 0}
        className="w-full bg-gray-900 text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-40"
      >
        {spotsLeft <= 0 ? 'Full — check other games' : busy ? 'Sending…' : "I'm in 🙋"}
      </button>
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
    </div>
  )
}
