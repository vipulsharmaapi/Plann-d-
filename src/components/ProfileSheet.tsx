import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Auth } from '../hooks/useAuth'

interface Props {
  auth: Auth
  open: boolean
  onClose: () => void
}

export default function ProfileSheet({ auth, open, onClose }: Props) {
  const { session } = auth
  const [name, setName] = useState('')
  const [stats, setStats] = useState<{ posts: number; joins: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open || !session) return
    setName(auth.firstName)
    setError(null)
    setSaved(false)
    Promise.all([
      supabase
        .from('intents')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', session.user.id),
      supabase
        .from('join_requests')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', session.user.id)
        .eq('status', 'accepted'),
    ]).then(([posts, joins]) => {
      setStats({ posts: posts.count ?? 0, joins: joins.count ?? 0 })
    })
  }, [open, session, auth.firstName])

  if (!open || !session) return null

  const save = async () => {
    const trimmed = name.trim()
    if (!trimmed) return setError('Name can’t be empty.')
    setBusy(true)
    setError(null)
    const err = await auth.saveFirstName(trimmed)
    if (!err) {
      // Keep the name shown on existing posts in sync
      await supabase.from('intents').update({ poster_name: trimmed }).eq('user_id', session.user.id)
    }
    setBusy(false)
    if (err) setError(err)
    else {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }

  return (
    <div className="absolute inset-0 z-30 flex items-end sm:items-center sm:justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-6 pb-8 space-y-4">
        <div className="w-10 h-1 rounded-full bg-gray-300 mx-auto sm:hidden" />
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gray-900 text-white flex items-center justify-center text-xl font-bold">
            {(auth.firstName || '?').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-gray-900">Your profile</h2>
            <p className="text-sm text-gray-500 truncate">{session.user.email}</p>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="flex-1 bg-gray-50 rounded-xl p-3 text-center">
            <p className="text-xl font-extrabold text-gray-900">{stats?.posts ?? '–'}</p>
            <p className="text-xs font-medium text-gray-500">posts</p>
          </div>
          <div className="flex-1 bg-gray-50 rounded-xl p-3 text-center">
            <p className="text-xl font-extrabold text-gray-900">{stats?.joins ?? '–'}</p>
            <p className="text-xs font-medium text-gray-500">joins</p>
          </div>
        </div>

        <label className="block text-sm font-medium text-gray-600">
          First name
          <div className="mt-1 flex gap-2">
            <input
              className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-base outline-none focus:border-gray-900"
              value={name}
              maxLength={30}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && save()}
            />
            <button
              onClick={save}
              disabled={busy || name.trim() === auth.firstName}
              className="bg-gray-900 text-white rounded-xl px-4 font-semibold text-sm disabled:opacity-40"
            >
              {busy ? '…' : saved ? '✓' : 'Save'}
            </button>
          </div>
        </label>
        <p className="text-xs text-gray-400 -mt-2">Shown on your posts and join requests.</p>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          onClick={async () => {
            await auth.signOut()
            onClose()
          }}
          className="w-full border border-gray-200 text-gray-600 rounded-xl py-3 text-sm font-semibold"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
