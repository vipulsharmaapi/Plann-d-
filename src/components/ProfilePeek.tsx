import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

interface Props {
  userId: string | null
  onClose: () => void
}

interface PeekData {
  firstName: string
  emoji: string
  avatarUrl: string | null
  memberSince: string
  posts: number
  joins: number
}

export default function ProfilePeek({ userId, onClose }: Props) {
  const [data, setData] = useState<PeekData | null>(null)

  useEffect(() => {
    if (!userId) return
    setData(null)
    Promise.all([
      supabase
        .from('profiles')
        .select('first_name, emoji, avatar_url, created_at')
        .eq('id', userId)
        .maybeSingle(),
      supabase
        .from('intents')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId),
      supabase
        .from('join_requests')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'accepted'),
    ]).then(([profile, posts, joins]) => {
      setData({
        firstName: profile.data?.first_name || 'Someone',
        emoji: profile.data?.emoji ?? '🙋',
        avatarUrl: profile.data?.avatar_url ?? null,
        memberSince: profile.data?.created_at
          ? new Date(profile.data.created_at).toLocaleDateString('en-IN', {
              month: 'short',
              year: 'numeric',
            })
          : '—',
        posts: posts.count ?? 0,
        joins: joins.count ?? 0,
      })
    })
  }, [userId])

  if (!userId) return null

  return (
    <div className="absolute inset-0 z-40 flex items-end sm:items-center sm:justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-3xl p-6 pb-8">
        <div className="w-10 h-1 rounded-full bg-gray-300 mx-auto sm:hidden mb-4" />
        {!data ? (
          <p className="text-center text-sm text-gray-400 py-6">Loading…</p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-gray-900 text-white flex items-center justify-center text-2xl overflow-hidden shrink-0">
                {data.avatarUrl ? (
                  <img src={data.avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  data.emoji
                )}
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">{data.firstName}</h2>
                <p className="text-xs text-gray-500">On Plann'd since {data.memberSince}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-1 bg-gray-50 rounded-xl p-3 text-center">
                <p className="text-xl font-extrabold text-gray-900">{data.posts}</p>
                <p className="text-xs font-medium text-gray-500">posts</p>
              </div>
              <div className="flex-1 bg-gray-50 rounded-xl p-3 text-center">
                <p className="text-xl font-extrabold text-gray-900">{data.joins}</p>
                <p className="text-xs font-medium text-gray-500">joins</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
