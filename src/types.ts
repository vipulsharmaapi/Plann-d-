export type ActivityKey = 'badminton' | 'football' | 'cricket' | 'running' | 'coffee'

export interface Activity {
  key: ActivityKey
  label: string
  emoji: string
  color: string
}

export const ACTIVITIES: Activity[] = [
  { key: 'badminton', label: 'Badminton', emoji: '🏸', color: '#22c55e' },
  { key: 'football', label: 'Football', emoji: '⚽', color: '#3b82f6' },
  { key: 'cricket', label: 'Cricket', emoji: '🏏', color: '#f59e0b' },
  { key: 'running', label: 'Running', emoji: '🏃', color: '#ef4444' },
  { key: 'coffee', label: 'Coffee', emoji: '☕', color: '#a855f7' },
]

export const activityByKey = (key: ActivityKey): Activity =>
  ACTIVITIES.find((a) => a.key === key)!

export interface Intent {
  id: string
  userId?: string | null
  whatsappLink?: string | null
  activity: ActivityKey
  title: string
  note?: string
  lat: number
  lng: number
  venueName: string
  startsAt: string // "19:00"
  endsAt: string // "21:00"
  spotsNeeded: number
  spotsFilled: number
  posterName: string
  posterJoinCount: number
  womenOnly: boolean
}
