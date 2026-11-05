import { useState } from 'react'
import { UserRound } from 'lucide-react'
import { usePublicProfile } from '../lib/profiles'

export default function Avatar({
  userId,
  name,
  url,
  emoji,
  size = 28,
  className = '',
}: {
  userId?: string | null
  name?: string
  url?: string | null
  emoji?: string
  size?: number
  className?: string
}) {
  const profile = usePublicProfile(userId)
  const photo = profile?.avatar_url !== undefined ? profile.avatar_url : url
  const fallback = profile?.emoji ?? emoji
  const displayName = profile?.first_name ?? name
  const [failed, setFailed] = useState<string | null>(null)
  const initials = displayName
    ?.trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
  return (
    <span
      className={`person-avatar ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {photo && failed !== photo ? (
        <img src={photo} alt="" onError={() => setFailed(photo)} />
      ) : fallback && fallback !== '🙋' ? (
        fallback
      ) : (
        initials || <UserRound size={size * 0.55} />
      )}
    </span>
  )
}
