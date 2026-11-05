import { useEffect, useSyncExternalStore } from 'react'
import { supabase } from './supabase'

export type PublicProfile = { first_name?: string; avatar_url?: string | null; emoji?: string }
const cache = new Map<string, PublicProfile>()
const listeners = new Set<() => void>()
const pending = new Set<string>()
const requested = new Map<string, number>()
const revisions = new Map<string, number>()
let timer: ReturnType<typeof setTimeout> | undefined
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
export function publishProfile(id: string, profile: PublicProfile) {
  revisions.set(id, (revisions.get(id) ?? 0) + 1)
  cache.set(id, { ...cache.get(id), ...profile })
  requested.set(id, Date.now())
  listeners.forEach((listener) => listener())
}
function requestProfile(id: string) {
  if (Date.now() - (requested.get(id) ?? 0) < 300000) return
  requested.set(id, Date.now())
  pending.add(id)
  if (timer) return
  timer = setTimeout(async () => {
    timer = undefined
    const ids = [...pending]
    pending.clear()
    const versions = new Map(ids.map((key) => [key, revisions.get(key) ?? 0]))
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id,first_name,avatar_url,emoji')
        .in('id', ids)
      if (error) return
      for (const profile of data ?? [])
        if ((revisions.get(profile.id) ?? 0) === versions.get(profile.id))
          publishProfile(profile.id, profile)
    } catch {
      /* Existing photos and fallbacks remain usable when offline. */
    }
  }, 0)
}
export function usePublicProfile(id?: string | null) {
  const profile = useSyncExternalStore(subscribe, () => (id ? cache.get(id) : undefined))
  useEffect(() => {
    if (id) requestProfile(id)
  }, [id])
  return profile
}
