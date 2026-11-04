import { useCallback, useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
export interface AppNotification {
  id: string
  type: string
  intent_id: string | null
  body: string
  read_at: string | null
  created_at: string
}
export function useNotifications(session: Session | null) {
  const [items, setItems] = useState<AppNotification[]>([]),
    [state, setState] = useState('loading')
  const [owner, setOwner] = useState<string | undefined>(undefined)
  const userId = session?.user.id
  const sequence = useRef(0)
  const refresh = useCallback(async () => {
    const request = ++sequence.current
    if (!userId) {
      setItems([])
      setState('ready')
      return
    }
    try {
      const remind = await supabase.rpc('deliver_my_reminders')
      if (remind.error) throw remind.error
      const { data, error } = await supabase
        .from('notifications')
        .select('id,type,intent_id,body,read_at,created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) throw error
      if (request !== sequence.current) return
      setItems(data ?? [])
      setState('ready')
    } catch {
      if (request !== sequence.current) return
      setState('error')
    }
  }, [userId])
  useEffect(() => {
    setOwner(userId)
    setItems([])
    setState('loading')
    refresh()
    if (!userId) return
    const c = supabase
      .channel('inbox-' + userId + '-' + crypto.randomUUID())
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        refresh,
      )
      .subscribe()
    const t = setInterval(refresh, 60000)
    window.addEventListener('focus', refresh)
    window.addEventListener('online', refresh)
    return () => {
      // Invalidate the latest request generation, not a DOM ref.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      sequence.current++
      supabase.removeChannel(c)
      clearInterval(t)
      window.removeEventListener('focus', refresh)
      window.removeEventListener('online', refresh)
    }
  }, [userId, refresh])
  const markRead = useCallback(
    async (id?: string, intentId?: string) => {
      if (!userId) return
      const now = new Date().toISOString()
      let q = supabase
        .from('notifications')
        .update({ read_at: now })
        .eq('user_id', userId)
        .is('read_at', null)
      if (id) q = q.eq('id', id)
      if (intentId) q = q.eq('intent_id', intentId).eq('type', 'chat_message')
      const { error } = await q
      if (error) {
        setState('error')
        return
      }
      setItems((prev) =>
        prev.map((n) =>
          (!id || n.id === id) &&
          (!intentId || (n.intent_id === intentId && n.type === 'chat_message'))
            ? { ...n, read_at: n.read_at ?? now }
            : n,
        ),
      )
    },
    [userId],
  )
  const visibleItems = owner === userId ? items : []
  return {
    items: visibleItems,
    state,
    unread: visibleItems.filter((i) => !i.read_at).length,
    refresh,
    markRead,
    markAllRead: () => markRead(),
    markChatRead: (id: string) => markRead(undefined, id),
  }
}
