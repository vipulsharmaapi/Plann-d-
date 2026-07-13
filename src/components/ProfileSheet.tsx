import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Auth } from '../hooks/useAuth'

interface Props {
  auth: Auth
  open: boolean
  onClose: () => void
}

const EMOJIS = [
  '🙋', '😎', '🔥', '⚡', '🏸', '⚽', '🏏', '🏃', '☕', '🎯',
  '🦁', '🐯', '🦅', '🐺', '🚀', '🌟', '🎸', '🎮', '🧗', '🚴',
]

export default function ProfileSheet({ auth, open, onClose }: Props) {
  const { session } = auth
  const [name, setName] = useState('')
  const [stats, setStats] = useState<{ posts: number; joins: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [emojiSaved, setEmojiSaved] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

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

  const flashSaved = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const save = async () => {
    const trimmed = name.trim()
    if (!trimmed) return setError('Name can’t be empty.')
    setBusy(true)
    setError(null)
    const err = await auth.saveProfile({ first_name: trimmed })
    if (!err) {
      // Keep the name shown on existing posts in sync
      await supabase.from('intents').update({ poster_name: trimmed }).eq('user_id', session.user.id)
    }
    setBusy(false)
    if (err) setError(err)
    else flashSaved()
  }

  const pickEmoji = async (e: string) => {
    setError(null)
    const err = await auth.saveProfile({ emoji: e })
    if (err) return setError(err)
    setEmojiSaved(true)
    setTimeout(() => setEmojiSaved(false), 1500)
  }

  const uploadAvatar = async (file: File) => {
    if (!file.type.startsWith('image/')) return setError('Pick an image file.')
    if (file.size > 4 * 1024 * 1024) return setError('Image too big — keep it under 4 MB.')
    setUploading(true)
    setError(null)
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `${session.user.id}/avatar.${ext}`
    const { error: upErr } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true, cacheControl: '3600' })
    if (upErr) {
      setUploading(false)
      return setError(upErr.message)
    }
    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    // Cache-bust so a replaced photo shows up immediately
    const url = `${data.publicUrl}?v=${Date.now()}`
    const err = await auth.saveProfile({ avatar_url: url })
    setUploading(false)
    if (err) setError(err)
    else flashSaved()
  }

  const removeAvatar = async () => {
    const err = await auth.saveProfile({ avatar_url: null })
    if (err) setError(err)
  }

  return (
    <div className="absolute inset-0 z-30 flex items-end sm:items-center sm:justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl max-h-[92%] overflow-y-auto p-6 pb-8 space-y-4">
        <div className="w-10 h-1 rounded-full bg-gray-300 mx-auto sm:hidden" />

        <div className="flex items-center gap-3">
          <button
            onClick={() => fileRef.current?.click()}
            className="relative w-16 h-16 rounded-2xl bg-gray-900 text-white flex items-center justify-center text-3xl overflow-hidden shrink-0"
            aria-label="Change profile photo"
          >
            {auth.avatarUrl ? (
              <img src={auth.avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              auth.emoji
            )}
            <span className="absolute bottom-0 inset-x-0 bg-black/50 text-[9px] font-semibold py-0.5">
              {uploading ? '…' : 'EDIT'}
            </span>
          </button>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-gray-900">Your profile</h2>
            <p className="text-sm text-gray-500 truncate">{session.user.email}</p>
            {auth.avatarUrl && (
              <button onClick={removeAvatar} className="text-xs text-gray-400 underline">
                Remove photo
              </button>
            )}
          </div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && uploadAvatar(e.target.files[0])}
        />

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
              disabled={busy || !name.trim()}
              className="bg-gray-900 text-white rounded-xl px-4 font-semibold text-sm disabled:opacity-40"
            >
              {busy ? '…' : saved ? '✓ Saved' : 'Save'}
            </button>
          </div>
        </label>

        <div>
          <p className="text-sm font-medium text-gray-600 mb-1.5">
            Your emoji <span className="text-gray-400">— shown when you have no photo</span>
            {emojiSaved && <span className="ml-2 text-green-600 font-semibold">✓ saved</span>}
          </p>
          <div className="grid grid-cols-10 gap-1">
            {EMOJIS.map((e) => (
              <button
                key={e}
                onClick={() => pickEmoji(e)}
                className={`aspect-square rounded-lg text-lg flex items-center justify-center ${
                  auth.emoji === e ? 'bg-gray-900' : 'bg-gray-50 hover:bg-gray-100'
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

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
