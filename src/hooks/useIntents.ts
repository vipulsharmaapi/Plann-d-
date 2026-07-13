import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { MOCK_INTENTS } from '../data/mockIntents'
import type { ActivityKey, Intent } from '../types'

interface IntentRow {
  id: string
  user_id: string | null
  poster_name: string
  activity: ActivityKey
  title: string
  note: string | null
  lat: number
  lng: number
  venue_name: string
  starts_at: string
  ends_at: string
  spots_needed: number
  spots_filled: number
  women_only: boolean
}

const istTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Kolkata',
  })

const rowToIntent = (row: IntentRow): Intent => ({
  id: row.id,
  userId: row.user_id,
  date: new Date(row.starts_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
  activity: row.activity,
  title: row.title,
  note: row.note ?? undefined,
  lat: row.lat,
  lng: row.lng,
  venueName: row.venue_name,
  startsAt: istTime(row.starts_at),
  endsAt: istTime(row.ends_at),
  spotsNeeded: row.spots_needed,
  spotsFilled: row.spots_filled,
  posterName: row.poster_name,
  posterJoinCount: 0,
  womenOnly: row.women_only,
})

export type IntentSource = 'live' | 'demo' | 'loading'

export function useIntents(): { intents: Intent[]; source: IntentSource; refresh: () => void } {
  const [intents, setIntents] = useState<Intent[]>([])
  const [source, setSource] = useState<IntentSource>('loading')

  const refresh = useCallback(async () => {
    const { data, error } = await supabase
      .from('intents')
      .select(
        'id, user_id, poster_name, activity, title, note, lat, lng, venue_name, starts_at, ends_at, spots_needed, spots_filled, women_only',
      )
      .in('status', ['open', 'full'])
      .gte('ends_at', new Date().toISOString())
      .order('starts_at')

    if (error) {
      // Schema not applied yet (or network issue) — keep the app usable
      // with demo data rather than an empty map.
      console.warn('[plannd] falling back to demo intents:', error.message)
      setIntents(MOCK_INTENTS)
      setSource('demo')
      return
    }
    setIntents((data as IntentRow[]).map(rowToIntent))
    setSource('live')
  }, [])

  useEffect(() => {
    refresh()
    const channel = supabase
      .channel('intents-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'intents' }, () => refresh())
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [refresh])

  return { intents, source, refresh }
}
