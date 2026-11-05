import Avatar from './Avatar'
import Sheet from './Sheet'
import { formatTimeRange } from '../lib/time'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Auth, Gender } from '../hooks/useAuth'
import { INTENT_COLUMNS, rowToIntent, type IntentRow } from '../hooks/useIntents'
import { activityByKey, humanDay, type Intent } from '../types'

interface Props {
  auth: Auth
  open: boolean
  onClose: () => void
  onViewIntent: (intent: Intent) => void
  onRepost: (intent: Intent) => void
}

interface MyPlan {
  intent: Intent
  status: string
  live: boolean
}

interface JoinedPlan {
  intent: Intent
  requestStatus: string
  live: boolean
}

const EMOJIS = [
  '🙋',
  '😎',
  '🔥',
  '⚡',
  '🏸',
  '⚽',
  '🏏',
  '🏃',
  '☕',
  '🎯',
  '🦁',
  '🐯',
  '🦅',
  '🐺',
  '🚀',
  '🌟',
  '🎸',
  '🎮',
  '🧗',
  '🚴',
]

export default function ProfileSheet({ auth, open, onClose, onViewIntent, onRepost }: Props) {
  const { session } = auth
  const [name, setName] = useState('')
  const [bio, setBio] = useState('')
  const [bioStatus, setBioStatus] = useState('')
  const [bioLoaded, setBioLoaded] = useState(false)
  const [stats, setStats] = useState<{ posts: number; joins: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [photoStatus, setPhotoStatus] = useState('')
  const [emojiSaved, setEmojiSaved] = useState(false)
  const [whatsapp, setWhatsapp] = useState('')
  const [savedWhatsapp, setSavedWhatsapp] = useState('')
  const [waSaved, setWaSaved] = useState(false)
  const [genderSaved, setGenderSaved] = useState(false)
  const [myPlans, setMyPlans] = useState<MyPlan[] | null>(null)
  const [joinedPlans, setJoinedPlans] = useState<JoinedPlan[] | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open || !session) return
    setName(auth.firstName)
    supabase
      .from('profiles')
      .select('bio')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!error) {
          setBio(data?.bio ?? '')
          setBioLoaded(true)
        } else setBioStatus('Could not load your introduction. Reopen your profile to try again.')
      })
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
    supabase
      .from('private_contacts')
      .select('whatsapp_number')
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        setWhatsapp(data?.whatsapp_number ?? '')
        setSavedWhatsapp(data?.whatsapp_number ?? '')
      })
    supabase
      .from('intents')
      .select(INTENT_COLUMNS)
      .eq('user_id', session.user.id)
      .order('starts_at', { ascending: false })
      .limit(20)
      .then(({ data }) => {
        const now = Date.now()
        setMyPlans(
          ((data ?? []) as (IntentRow & { status: string })[]).map((row) => ({
            intent: rowToIntent(row),
            status: row.status,
            live:
              (row.status === 'open' || row.status === 'full') &&
              new Date(row.ends_at).getTime() > now,
          })),
        )
      })
    supabase
      .from('join_requests')
      .select(`status, intents(${INTENT_COLUMNS})`)
      .eq('user_id', session.user.id)
      .in('status', ['pending', 'accepted'])
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => {
        const now = Date.now()
        setJoinedPlans(
          ((data ?? []) as unknown as { status: string; intents: IntentRow & { status: string } }[])
            .filter((r) => r.intents)
            .map((r) => ({
              intent: rowToIntent(r.intents),
              requestStatus: r.status,
              live:
                (r.intents.status === 'open' || r.intents.status === 'full') &&
                new Date(r.intents.ends_at).getTime() > now,
            })),
        )
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
    if (uploading) return
    setPhotoStatus('')
    setError(null)
    const formats: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
    }
    if (!formats[file.type]) return setError('Choose a JPG, PNG, WebP or GIF image.')
    if (file.size > 4 * 1024 * 1024) return setError('Choose an image under 4 MB.')
    setUploading(true)
    // A new object keeps the previous image intact if saving the profile fails.
    const path = `${session.user.id}/${crypto.randomUUID()}.${formats[file.type]}`
    try {
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { cacheControl: '3600' })
      if (uploadError) throw uploadError
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      const error = await auth.saveProfile({ avatar_url: data.publicUrl })
      if (error) {
        await supabase.storage
          .from('avatars')
          .remove([path])
          .catch(() => {})
        throw new Error(error)
      }
      setPhotoStatus('Photo updated. Your new photo is now used across Plann’d.')
    } catch {
      setError('Could not update your photo. Your previous photo is still saved. Try again.')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const pickGender = async (g: Gender) => {
    if (!confirm('Save this self-declared gender? Corrections can be requested in Help.')) return
    setError(null)
    const err = await auth.saveProfile({ gender: g })
    if (err) return setError(err)
    setGenderSaved(true)
    setTimeout(() => setGenderSaved(false), 1500)
  }

  const saveWhatsapp = async () => {
    const digits = whatsapp.replace(/[^\d+]/g, '')
    if (digits && digits.replace(/\D/g, '').length < 10)
      return setError('Enter the full number with country code, e.g. +91 98765 43210.')
    setError(null)
    const { error: err } = await supabase
      .from('private_contacts')
      .upsert({ user_id: session.user.id, whatsapp_number: digits || null })
    if (err) return setError(err.message)
    setSavedWhatsapp(digits)
    setWhatsapp(digits)
    setWaSaved(true)
    setTimeout(() => setWaSaved(false), 2000)
  }

  const removeAvatar = async () => {
    if (uploading) return
    setUploading(true)
    setError(null)
    setPhotoStatus('')
    try {
      const error = await auth.saveProfile({ avatar_url: null })
      if (error) throw new Error(error)
      setPhotoStatus('Profile photo removed.')
    } catch {
      setError('Could not remove your photo. Try again.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <Sheet title="Your profile" onClose={onClose} className="profile-dialog">
      <div className="sheet-panel relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl max-h-[92%] overflow-y-auto p-6 pb-8 space-y-4">
        <h2>Your profile</h2>
        <div className="profile-photo-row">
          <Avatar
            userId={session.user.id}
            name={auth.firstName}
            url={auth.avatarUrl}
            emoji={auth.emoji}
            size={88}
          />
          <div>
            <h3>Your profile photo</h3>
            <p>Shown on your profile, plans and messages.</p>
          </div>
        </div>
        <button
          className="secondary w-full"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? 'Saving photo…' : 'Change photo'}
        </button>
        {auth.avatarUrl && (
          <button onClick={removeAvatar} disabled={uploading} className="text-button">
            Remove photo
          </button>
        )}
        <p className="text-sm text-gray-600">JPG, PNG, WebP or GIF, up to 4 MB.</p>
        {photoStatus && (
          <p role="status" className="profile-photo-status">
            {photoStatus}
          </p>
        )}
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <input
          ref={fileRef}
          aria-label="Upload profile photo"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) void uploadAvatar(file)
          }}
        />

        <label className="block text-sm font-medium text-gray-600">
          Display name
          <div className="mt-1 flex gap-2">
            <input
              className="min-w-0 flex-1 rounded-xl border border-gray-300 px-4 py-3 text-base outline-none focus:border-gray-900"
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

        <details className="profile-settings">
          <summary>Profile &amp; account details</summary>
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

          <div className="space-y-2">
            <label className="field">
              Short introduction (optional)
              <textarea
                rows={3}
                maxLength={240}
                value={bio}
                onChange={(e) => {
                  setBio(e.target.value)
                  setBioStatus('')
                }}
                placeholder="What do you enjoy doing? What can people expect when they join you?"
              />
            </label>
            <p className="text-xs text-gray-600">
              Public on your profile and plans. Leave out contact details.
            </p>
            <button
              className="secondary text-sm"
              disabled={busy || !bioLoaded}
              onClick={async () => {
                if (!session || busy || !bioLoaded) return
                setBusy(true)
                try {
                  const { error } = await supabase
                    .from('profiles')
                    .update({ bio: bio.trim() || null })
                    .eq('id', session.user.id)
                  setBioStatus(
                    error ? 'Could not save your introduction. Try again.' : 'Introduction saved.',
                  )
                } catch {
                  setBioStatus('Could not connect. Try again.')
                } finally {
                  setBusy(false)
                }
              }}
            >
              Save introduction
            </button>
            {bioStatus && (
              <p role="status" className="text-sm">
                {bioStatus}
              </p>
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600 mb-1.5">
              Your emoji <span className="text-gray-400">(used without a photo)</span>
              {emojiSaved && <span className="ml-2 text-green-600 font-semibold">✓ saved</span>}
            </p>
            <div className="grid grid-cols-5 gap-1">
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

          <div>
            <p className="text-sm font-medium text-gray-600 mb-1.5">
              Gender <span className="text-gray-400">(for women-only plans)</span>
              {genderSaved && <span className="ml-2 text-green-600 font-semibold">✓ saved</span>}
            </p>
            {auth.gender ? (
              <p className="rounded-xl bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-700 capitalize">
                {auth.gender}{' '}
                <span className="font-normal text-gray-400">· corrections through Help</span>
              </p>
            ) : (
              <>
                <div className="flex gap-2">
                  {(
                    [
                      ['female', 'Female'],
                      ['male', 'Male'],
                      ['other', 'Other'],
                    ] as [Gender, string][]
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => pickGender(key)}
                      className="flex-1 rounded-xl py-2.5 text-sm font-semibold border bg-white text-gray-700 border-gray-300"
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-amber-700">⚠️ Can't be changed once set.</p>
              </>
            )}
          </div>

          <label className="block text-sm font-medium text-gray-600">
            WhatsApp number{' '}
            <span className="text-gray-400 font-normal">
              Shared only with hosts or participants after approval.
            </span>
            {waSaved && <span className="ml-2 text-green-600 font-semibold">✓ saved</span>}
            <div className="mt-1 flex gap-2">
              <input
                className="min-w-0 flex-1 rounded-xl border border-gray-300 px-4 py-3 text-base outline-none focus:border-gray-900"
                inputMode="tel"
                placeholder="+91 98765 43210"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveWhatsapp()}
              />
              <button
                onClick={saveWhatsapp}
                disabled={whatsapp.trim() === savedWhatsapp}
                className="bg-gray-900 text-white rounded-xl px-4 font-semibold text-sm disabled:opacity-40"
              >
                Save
              </button>
            </div>
          </label>

          <div>
            <p className="text-sm font-medium text-gray-600 mb-1.5">My plans</p>
            {!myPlans && <p className="text-sm text-gray-400">Loading…</p>}
            {myPlans && myPlans.length === 0 && (
              <p className="text-sm text-gray-400">No plans posted yet.</p>
            )}
            <div className="space-y-1.5 max-h-56 overflow-y-auto">
              {myPlans?.map(({ intent, status, live }) => (
                <div
                  key={intent.id}
                  className={`flex items-center gap-2.5 rounded-xl px-3 py-2 ${
                    live ? 'bg-gray-50' : 'bg-gray-50/50'
                  }`}
                >
                  <span className="text-lg shrink-0">{activityByKey(intent.activity).emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-sm font-semibold truncate ${live ? 'text-gray-900' : 'text-gray-400'}`}
                    >
                      {intent.title}
                    </p>
                    <p className="text-xs text-gray-400">
                      {humanDay(intent.date)} · {formatTimeRange(intent.startsAt, intent.endsAt)}
                      {status === 'cancelled' && ' · cancelled'}
                      {!live && status !== 'cancelled' && ' · over'}
                    </p>
                  </div>
                  {live ? (
                    <button
                      onClick={() => onViewIntent(intent)}
                      className="shrink-0 bg-gray-900 text-white rounded-lg px-3 py-1.5 text-xs font-semibold"
                    >
                      View
                    </button>
                  ) : (
                    <button
                      onClick={() => onRepost(intent)}
                      className="shrink-0 bg-white border border-gray-200 text-gray-700 rounded-lg px-3 py-1.5 text-xs font-semibold"
                    >
                      Post again
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-600 mb-1.5">Joined</p>
            {!joinedPlans && <p className="text-sm text-gray-400">Loading…</p>}
            {joinedPlans && joinedPlans.length === 0 && (
              <p className="text-sm text-gray-400">No plans joined yet.</p>
            )}
            <div className="space-y-1.5 max-h-56 overflow-y-auto">
              {joinedPlans?.map(({ intent, requestStatus, live }) => (
                <div
                  key={intent.id}
                  className={`flex items-center gap-2.5 rounded-xl px-3 py-2 ${live ? 'bg-gray-50' : 'bg-gray-50/50'}`}
                >
                  <span className="text-lg shrink-0">{activityByKey(intent.activity).emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-sm font-semibold truncate ${live ? 'text-gray-900' : 'text-gray-400'}`}
                    >
                      {intent.title}
                    </p>
                    <p className="text-xs text-gray-400">
                      {humanDay(intent.date)} · {formatTimeRange(intent.startsAt, intent.endsAt)} ·
                      by {intent.posterName}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-[10px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5 ${
                      requestStatus === 'accepted'
                        ? 'bg-green-50 text-green-700'
                        : 'bg-amber-50 text-amber-700'
                    }`}
                  >
                    {requestStatus === 'accepted' ? 'in 🎉' : 'pending'}
                  </span>
                  {live && (
                    <button
                      onClick={() => onViewIntent(intent)}
                      className="shrink-0 bg-gray-900 text-white rounded-lg px-3 py-1.5 text-xs font-semibold"
                    >
                      View
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
        </details>
        <button
          onClick={async () => {
            await auth.signOut()
            onClose()
          }}
          className="w-full border border-gray-200 text-gray-600 rounded-xl py-3 text-sm font-semibold transition-colors hover:bg-gray-100 hover:text-gray-900 hover:border-gray-300"
        >
          Sign out
        </button>
      </div>
    </Sheet>
  )
}
