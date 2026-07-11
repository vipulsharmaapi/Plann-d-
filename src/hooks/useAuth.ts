import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export interface Auth {
  session: Session | null
  firstName: string
  sendOtp: (email: string) => Promise<string | null>
  verifyOtp: (email: string, token: string) => Promise<string | null>
  saveFirstName: (name: string) => Promise<string | null>
  signOut: () => Promise<void>
}

export function useAuth(): Auth {
  const [session, setSession] = useState<Session | null>(null)
  const [firstName, setFirstName] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) {
      setFirstName('')
      return
    }
    supabase
      .from('profiles')
      .select('first_name')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data }) => setFirstName(data?.first_name ?? ''))
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

  const saveFirstName = useCallback(
    async (name: string) => {
      if (!session) return 'Not signed in'
      const { error } = await supabase
        .from('profiles')
        .update({ first_name: name })
        .eq('id', session.user.id)
      if (!error) setFirstName(name)
      return error?.message ?? null
    },
    [session],
  )

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  return { session, firstName, sendOtp, verifyOtp, saveFirstName, signOut }
}
