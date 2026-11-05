import { type Intent, type ActivityKey, todayIST } from '../types'
export const groups = ['All plans', 'Coffee', 'Sports', 'Outdoors', 'Food', 'Board games'] as const
export function planGroup(activity: ActivityKey): string {
  if (activity === 'coffee') return 'Coffee'
  if (activity === 'food') return 'Food'
  if (activity === 'boardgames') return 'Board games'
  if (['running', 'cycling', 'trekking'].includes(activity)) return 'Outdoors'
  if (
    ['badminton', 'football', 'cricket', 'tennis', 'basketball', 'gym', 'swimming'].includes(
      activity,
    )
  )
    return 'Sports'
  return 'Other'
}
export function planArtwork(plan: Pick<Intent, 'activity'>) {
  return `/images/${plan.activity === 'badminton' ? 'jaipur-badminton' : plan.activity === 'boardgames' ? 'jaipur-games' : ['coffee', 'food'].includes(plan.activity) ? 'jaipur-cafe' : 'jaipur-canopy'}.webp`
}
export function matchesDay(date: string, filter: string, today = todayIST()) {
  if (filter === 'all') return true
  if (filter === 'today') return date === today
  const base = new Date(`${today}T12:00:00+05:30`)
  const shift = (days: number) =>
    new Date(base.getTime() + days * 86400000).toLocaleDateString('en-CA', {
      timeZone: 'Asia/Kolkata',
    })
  if (filter === 'tomorrow') return date === shift(1)
  if (filter === 'weekend') {
    const weekday = new Date(`${today}T12:00:00Z`).getUTCDay()
    const offset = weekday === 0 ? 0 : (6 - weekday + 7) % 7
    return date === shift(offset) || (weekday !== 0 && date === shift(offset + 1))
  }
  return true
}
