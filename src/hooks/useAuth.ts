import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export interface ProfileFields {
  first_name?: string
  emoji?: string
  avatar_url?: string | null
}

export interface Auth {
  session: Session | null
  firstName: string
  emoji: string
  avatarUrl: string | null
  sendOtp: (email: string) => Promise<string | null>
  verifyOtp: (email: string, token: string) => Promise<string | null>
  saveFirstName: (name: string) => Promise<string | null>
  saveProfile: (fields: ProfileFields) => Promise<string | null>
  signOut: () => Promise<void>
}

export function useAuth(): Auth {
  const [session, setSession] = useState<Session | null>(null)
  const [firstName, setFirstName] = useState('')
  const [emoji, setEmoji] = useState('🙋')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) {
      setFirstName('')
      setEmoji('🙋')
      setAvatarUrl(null)
      return
    }
    supabase
      .from('profiles')
      .select('first_name, emoji, avatar_url')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(async ({ data, error }) => {
        if (error) {
          // emoji/avatar_url columns may not exist yet (migration not run) —
          // fall back to the original shape so sign-in still works.
          const { data: basic } = await supabase
            .from('profiles')
            .select('first_name')
            .eq('id', session.user.id)
            .maybeSingle()
          setFirstName(basic?.first_name ?? '')
          setEmoji('🙋')
          setAvatarUrl(null)
          return
        }
        setFirstName(data?.first_name ?? '')
        setEmoji(data?.emoji ?? '🙋')
        setAvatarUrl(data?.avatar_url ?? null)
      })
  }, [session])

  const sendOtp = useCallback(async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    })
    return error?.message ?? null
  }, [])

  const verifyOtp = useCallback(async (email: string, token: string) => {
    const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' })
    return error?.message ?? null
  }, [])

  const saveProfile = useCallback(
    async (fields: ProfileFields) => {
      if (!session) return 'Not signed in'
      const { error } = await supabase.from('profiles').update(fields).eq('id', session.user.id)
      if (!error) {
        if (fields.first_name !== undefined) setFirstName(fields.first_name)
        if (fields.emoji !== undefined) setEmoji(fields.emoji)
        if (fields.avatar_url !== undefined) setAvatarUrl(fields.avatar_url)
      }
      return error?.message ?? null
    },
    [session],
  )

  const saveFirstName = useCallback(
    (name: string) => saveProfile({ first_name: name }),
    [saveProfile],
  )

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  return {
    session,
    firstName,
    emoji,
    avatarUrl,
    sendOtp,
    verifyOtp,
    saveFirstName,
    saveProfile,
    signOut,
  }
}
