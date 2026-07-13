import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Auth } from '../hooks/useAuth'
import type { Intent } from '../types'

interface Props {
  intent: Intent
  auth: Auth
  onRequestAuth: () => void
  onEdit: (intent: Intent) => void
}

interface RequestRow {
  id: string
  user_id: string
  status: 'pending' | 'accepted' | 'declined'
  requesterName?: string
}

export default function JoinSection({ intent, auth, onRequestAuth, onEdit }: Props) {
  const { session } = auth
  const isMine = !!session && intent.userId === session.user.id
  const [myRequest, setMyRequest] = useState<RequestRow | null>(null)
  const [requests, setRequests] = useState<RequestRow[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    setBusy(false)
    if (err) setError(err.message)
    else load()
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
            <span className="flex-1 font-medium text-gray-800">{r.requesterName}</span>
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
            ) : (
              <span
                className={`text-xs font-semibold ${
                  r.status === 'accepted' ? 'text-green-700' : 'text-gray-400'
                }`}
              >
                {r.status}
              </span>
            )}
          </div>
        ))}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    )
  }

  if (myRequest?.status === 'accepted') {
    return (
      <div className="mt-3 space-y-2">
        <p className="text-sm font-semibold text-green-700">You're in! 🎉</p>
        {intent.whatsappLink ? (
          <a
            href={intent.whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center bg-green-600 text-white rounded-xl py-2.5 text-sm font-semibold"
          >
            Join the WhatsApp group
          </a>
        ) : (
          <p className="text-xs text-gray-500">
            {intent.posterName} will coordinate — check back here.
          </p>
        )}
      </div>
    )
  }

  if (myRequest?.status === 'pending') {
    return (
      <p className="mt-3 text-center text-sm font-semibold text-gray-500 bg-gray-100 rounded-xl py-2.5">
        Requested — waiting for {intent.posterName} ⏳
      </p>
    )
  }

  if (myRequest?.status === 'declined') {
    return (
      <p className="mt-3 text-center text-sm font-semibold text-gray-400 bg-gray-50 rounded-xl py-2.5">
        This one didn't work out — plenty more on the map
      </p>
    )
  }

  return (
    <div className="mt-3">
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
