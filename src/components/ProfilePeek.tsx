import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Sheet from './Sheet'
interface Profile {
  first_name: string
  emoji: string
  avatar_url: string | null
  created_at: string
}
export default function ProfilePeek({
  userId,
  onClose,
}: {
  userId: string | null
  onClose: () => void
}) {
  const [profile, setProfile] = useState<Profile | null>(null),
    [error, setError] = useState('')
  useEffect(() => {
    let active = true
    if (userId)
      supabase
        .from('profiles')
        .select('first_name,emoji,avatar_url,created_at')
        .eq('id', userId)
        .maybeSingle()
        .then(({ data, error }) => {
          if (active) {
            setProfile(data)
            if (error || !data) setError('This profile is unavailable.')
          }
        })
    return () => {
      active = false
    }
  }, [userId])
  if (!userId) return null
  return (
    <Sheet title="Member profile" onClose={onClose}>
      <div className="p-6 pt-16">
        {error ? (
          <p role="alert">{error}</p>
        ) : !profile ? (
          <p role="status">Loading profile…</p>
        ) : (
          <>
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-2xl bg-indigo-50 flex justify-center items-center overflow-hidden text-3xl">
                {profile.avatar_url ? (
                  <img className="h-full w-full object-cover" alt="" src={profile.avatar_url} />
                ) : (
                  profile.emoji
                )}
              </div>
              <div>
                <h2 className="text-xl font-bold">{profile.first_name || 'Member'}</h2>
                <p className="text-sm text-gray-600">
                  Member since{' '}
                  {new Date(profile.created_at).toLocaleDateString('en-IN', {
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
              </div>
            </div>
            <p className="mt-5 text-sm text-gray-600">
              Profile details are self-declared. Meet in a public place and confirm arrangements in
              the group chat.
            </p>
          </>
        )}
      </div>
    </Sheet>
  )
}
