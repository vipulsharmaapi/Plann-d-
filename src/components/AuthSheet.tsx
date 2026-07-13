import { useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Auth } from '../hooks/useAuth'

interface Props {
  auth: Auth
  open: boolean
  onClose: () => void
  onSignedIn: () => void
}

type Step = 'email' | 'code' | 'name'

export default function AuthSheet({ auth, open, onClose, onSignedIn }: Props) {
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!open) return null

  const submitEmail = async () => {
    setBusy(true)
    setError(null)
    const err = await auth.sendOtp(email.trim())
    setBusy(false)
    if (err) setError(err)
    else setStep('code')
  }

  const submitCode = async () => {
    setBusy(true)
    setError(null)
    const err = await auth.verifyOtp(email.trim(), code.trim())
    if (err) {
      setBusy(false)
      setError(err)
      return
    }
    // auth.firstName is fetched asynchronously after the session change, so
    // read the profile directly to decide whether to ask for a name.
    const { data: userData } = await supabase.auth.getUser()
    const { data: profile } = userData.user
      ? await supabase.from('profiles').select('first_name').eq('id', userData.user.id).maybeSingle()
      : { data: null }
    setBusy(false)
    if (profile?.first_name) {
      onSignedIn()
    } else {
      setStep('name')
    }
  }

  const submitName = async () => {
    setBusy(true)
    setError(null)
    const err = await auth.saveFirstName(name.trim())
    setBusy(false)
    if (err) setError(err)
    else onSignedIn()
  }

  const inputCls =
    'w-full rounded-xl border border-gray-300 px-4 py-3 text-base outline-none focus:border-gray-900'

  return (
    <div className="absolute inset-0 z-30 flex items-end sm:items-center sm:justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-6 pb-8 space-y-4">
        <div className="w-10 h-1 rounded-full bg-gray-300 mx-auto sm:hidden" />

        {step === 'email' && (
          <>
            <h2 className="text-lg font-bold text-gray-900">Sign in to Plann'd</h2>
            <p className="text-sm text-gray-500">
              We'll email you a one-time code. No passwords.
            </p>
            <input
              className={inputCls}
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && email.includes('@') && submitEmail()}
            />
            <button
              onClick={submitEmail}
              disabled={busy || !email.includes('@')}
              className="w-full bg-gray-900 text-white rounded-xl py-3 font-semibold disabled:opacity-40"
            >
              {busy ? 'Sending…' : 'Send code'}
            </button>
          </>
        )}

        {step === 'code' && (
          <>
            <h2 className="text-lg font-bold text-gray-900">Check your email</h2>
            <p className="text-sm text-gray-500">
              Enter the code sent to <span className="font-medium">{email}</span>
            </p>
            <input
              className={`${inputCls} tracking-[0.4em] text-center font-mono text-xl`}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={10}
              placeholder="••••••"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              onKeyDown={(e) => e.key === 'Enter' && code.length >= 6 && submitCode()}
            />
            <button
              onClick={submitCode}
              disabled={busy || code.length < 6}
              className="w-full bg-gray-900 text-white rounded-xl py-3 font-semibold disabled:opacity-40"
            >
              {busy ? 'Verifying…' : 'Verify'}
            </button>
            <button onClick={() => setStep('email')} className="w-full text-sm text-gray-500">
              Use a different email
            </button>
          </>
        )}

        {step === 'name' && (
          <>
            <h2 className="text-lg font-bold text-gray-900">What should people call you?</h2>
            <p className="text-sm text-gray-500">
              First name only — it's shown on your posts.
            </p>
            <input
              className={inputCls}
              placeholder="First name"
              value={name}
              maxLength={30}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && name.trim() && submitName()}
            />
            <button
              onClick={submitName}
              disabled={busy || !name.trim()}
              className="w-full bg-gray-900 text-white rounded-xl py-3 font-semibold disabled:opacity-40"
            >
              {busy ? 'Saving…' : "Let's go"}
            </button>
          </>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </div>
  )
}
