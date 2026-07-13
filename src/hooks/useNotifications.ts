import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export interface AppNotification {
  id: string
  type: 'join_request' | 'request_accepted' | 'chat_message'
  intent_id: string | null
  body: string
  read_at: string | null
  created_at: string
}

export function useNotifications(session: Session | null) {
  const [items, setItems] = useState<AppNotification[]>([])

  const refresh = useCallback(async () => {
    if (!session) {
      setItems([])
      return
    }
    const { data, error } = await supabase
      .from('notifications')
      .select('id, type, intent_id, body, read_at, created_at')
      .order('created_at', { ascending: false })
      .limit(30)
    if (!error) setItems((data ?? []) as AppNotification[])
  }, [session])

  useEffect(() => {
    refresh()
    if (!session) return
    const channel = supabase
      .channel('my-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${session.user.id}`,
        },
        (payload) => {
          const n = payload.new as AppNotification
          setItems((prev) => (prev.some((p) => p.id === n.id) ? prev : [n, ...prev].slice(0, 30)))
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [session, refresh])

  const unread = items.filter((n) => !n.read_at).length

  const markAllRead = useCallback(async () => {
    if (!session || unread === 0) return
    const now = new Date().toISOString()
    setItems((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: now })))
    await supabase
      .from('notifications')
      .update({ read_at: now })
      .eq('user_id', session.user.id)
      .is('read_at', null)
  }, [session, unread])

  return { items, unread, markAllRead, refresh }
}
