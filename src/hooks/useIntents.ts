import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { ActivityKey, Intent } from '../types'

export interface IntentRow {
  id: string
  user_id: string | null
  poster_name: string
  activity: ActivityKey
  title: string
  note: string | null
  lat: number
  lng: number
  venue_name: string
  google_place_id?: string | null
  venue_menu_url?: string | null
  venue_area?: string | null
  expected_cost?: number | null
  skill_level?: Intent['skillLevel']
  booking_status?: Intent['bookingStatus']
  meeting_instructions?: string | null
  starts_at: string
  ends_at: string
  spots_needed: number
  spots_filled: number
  status?: Intent['status']
  women_only: boolean
}

const istTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Kolkata',
  })

export const INTENT_COLUMNS =
  'id, user_id, poster_name, activity, title, note, lat, lng, venue_name, starts_at, ends_at, spots_needed, spots_filled, women_only, status, google_place_id, venue_menu_url, venue_area, expected_cost, skill_level, booking_status, meeting_instructions'

export const rowToIntent = (row: IntentRow): Intent => ({
  id: row.id,
  startsAtIso: row.starts_at,
  endsAtIso: row.ends_at,
  status: row.status,
  userId: row.user_id,
  date: new Date(row.starts_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
  activity: row.activity,
  title: row.title,
  note: row.note ?? undefined,
  lat: row.lat,
  lng: row.lng,
  venueName: row.venue_name,
  venueArea: row.venue_area ?? undefined,
  expectedCost: row.expected_cost,
  skillLevel: row.skill_level,
  bookingStatus: row.booking_status,
  meetingInstructions: row.meeting_instructions,
  googlePlaceId: row.google_place_id,
  venueMenuUrl: row.venue_menu_url,
  startsAt: istTime(row.starts_at),
  endsAt: istTime(row.ends_at),
  spotsNeeded: row.spots_needed,
  spotsFilled: row.spots_filled,
  posterName: row.poster_name,
  posterJoinCount: 0,
  womenOnly: row.women_only,
})

export type IntentSource = 'live' | 'error' | 'loading'
export function useIntents(userId?: string) {
  const [intents, setIntents] = useState<Intent[]>([])
  const [source, setSource] = useState<IntentSource>('loading')
  const sequence = useRef(0)
  const refresh = useCallback(async () => {
    const request = ++sequence.current
    try {
      const { data, error } = await supabase
        .from('intents')
        .select(INTENT_COLUMNS)
        .in('status', ['open', 'full'])
        .gte('ends_at', new Date().toISOString())
        .order('starts_at')
      if (error) throw error
      let rows = (data ?? []) as IntentRow[]
      if (userId) {
        const { data: blocks, error: blockError } = await supabase
          .from('user_blocks')
          .select('blocked_user_id')
        if (blockError) throw blockError
        const blocked = new Set((blocks ?? []).map((b) => b.blocked_user_id))
        rows = rows.filter((r) => !blocked.has(r.user_id))
      }
      if (request !== sequence.current) return
      setIntents(rows.map(rowToIntent))
      setSource('live')
    } catch {
      if (request !== sequence.current) return
      setSource('error')
    }
  }, [userId])
  useEffect(() => {
    setIntents([])
    setSource('loading')
    refresh()
    const channel = supabase
      .channel('discovery-' + (userId ?? 'public') + '-' + crypto.randomUUID())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'intents' }, () => refresh())
      .subscribe()
    const timer = setInterval(refresh, 60000)
    const focus = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    window.addEventListener('plannd:blocks-changed', refresh)
    window.addEventListener('online', refresh)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', focus)
    return () => {
      // Invalidate the latest request generation, not a DOM ref.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      sequence.current++
      supabase.removeChannel(channel)
      clearInterval(timer)
      window.removeEventListener('plannd:blocks-changed', refresh)
      window.removeEventListener('online', refresh)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', focus)
    }
  }, [refresh, userId])
  return { intents, source, refresh }
}
