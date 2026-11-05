import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
export function useSavedPlans(userId?: string) {
  const [ids, setIds] = useState<string[]>([]),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(!!userId),
    [busy, setBusy] = useState(false)
  const generation = useRef(0),
    locked = useRef(false)
  const refresh = useCallback(async () => {
    const request = ++generation.current
    if (!userId) {
      setIds([])
      setLoading(false)
      setError('')
      return
    }
    try {
      const { data, error } = await supabase
        .from('saved_plans')
        .select('intent_id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
      if (request !== generation.current) return
      if (error) throw error
      setIds((data ?? []).map((r) => r.intent_id))
      setError('')
    } catch {
      if (request === generation.current) setError('Couldn’t load saved plans. Try again.')
    } finally {
      if (request === generation.current) setLoading(false)
    }
  }, [userId])
  useEffect(() => {
    setIds([])
    setLoading(!!userId)
    void refresh()
    const onFocus = () => {
      if (!locked.current) void refresh()
    }
    window.addEventListener('focus', onFocus)
    return () => {
      // Invalidate pending request generations, not a DOM ref.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      generation.current++
      window.removeEventListener('focus', onFocus)
    }
  }, [refresh, userId])
  async function toggle(id: string) {
    if (!userId || locked.current || loading || error) return
    locked.current = true
    setBusy(true)
    const request = ++generation.current
    try {
      const removing = ids.includes(id)
      const result = removing
        ? await supabase.from('saved_plans').delete().eq('user_id', userId).eq('intent_id', id)
        : await supabase.from('saved_plans').insert({ user_id: userId, intent_id: id })
      if (generation.current !== request) return
      if (result.error && result.error.code !== '23505') throw result.error
      setIds((prev) => (removing ? prev.filter((i) => i !== id) : [...new Set([id, ...prev])]))
    } catch {
      if (generation.current === request)
        setError('Couldn’t update saved plans. Refresh and try again.')
    } finally {
      locked.current = false
      setBusy(false)
    }
  }
  return { ids, error, loading, busy, toggle, refresh }
}
export type SavedPlans = ReturnType<typeof useSavedPlans>
