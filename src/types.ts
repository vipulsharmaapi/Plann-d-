export const ACTIVITIES = [
  { key: 'badminton', label: 'Badminton', emoji: '🏸', color: '#22c55e' },
  { key: 'football', label: 'Football', emoji: '⚽', color: '#3b82f6' },
  { key: 'cricket', label: 'Cricket', emoji: '🏏', color: '#f59e0b' },
  { key: 'tennis', label: 'Tennis', emoji: '🎾', color: '#84cc16' },
  { key: 'basketball', label: 'Basketball', emoji: '🏀', color: '#f97316' },
  { key: 'running', label: 'Running', emoji: '🏃', color: '#ef4444' },
  { key: 'cycling', label: 'Cycling', emoji: '🚴', color: '#06b6d4' },
  { key: 'gym', label: 'Gym', emoji: '🏋️', color: '#8b5cf6' },
  { key: 'swimming', label: 'Swimming', emoji: '🏊', color: '#0ea5e9' },
  { key: 'coffee', label: 'Coffee', emoji: '☕', color: '#a855f7' },
  { key: 'food', label: 'Food', emoji: '🍜', color: '#ec4899' },
  { key: 'boardgames', label: 'Board games', emoji: '🎲', color: '#14b8a6' },
  { key: 'movies', label: 'Movies', emoji: '🎬', color: '#6366f1' },
  { key: 'trekking', label: 'Trekking', emoji: '🥾', color: '#65a30d' },
  { key: 'other', label: 'Something else', emoji: '✨', color: '#64748b' },
] as const

export type ActivityKey = (typeof ACTIVITIES)[number]['key']

export interface Activity {
  key: ActivityKey
  label: string
  emoji: string
  color: string
}

// Unknown keys (e.g. rows newer than this build) fall back to 'other'
export const activityByKey = (key: string): Activity =>
  (ACTIVITIES.find((a) => a.key === key) ?? ACTIVITIES[ACTIVITIES.length - 1]) as Activity

export const todayIST = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })

export const humanDay = (date: string): string => {
  if (date === todayIST()) return 'Today'
  const tomorrow = new Date(Date.now() + 86400000).toLocaleDateString('en-CA', {
    timeZone: 'Asia/Kolkata',
  })
  if (date === tomorrow) return 'Tomorrow'
  return new Date(`${date}T12:00:00+05:30`).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Kolkata',
  })
}

export interface Intent {
  id: string
  userId?: string | null
  activity: ActivityKey
  title: string
  note?: string
  lat: number
  lng: number
  venueName: string
  date: string // "2026-07-14" (IST)
  startsAt: string // "19:00"
  endsAt: string // "21:00"
  spotsNeeded: number
  spotsFilled: number
  posterName: string
  posterJoinCount: number
  womenOnly: boolean
}
