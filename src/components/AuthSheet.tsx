import { useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Auth, Gender } from '../hooks/useAuth'

interface Props {
  auth: Auth
  open: boolean
  onClose: () => void
  onSignedIn: () => void
}

type Step = 'email' | 'code' | 'pw' | 'pw-code' | 'pw-forgot' | 'pw-reset' | 'name'

export default function AuthSheet({ auth, open, onClose, onSignedIn }: Props) {
  const [step, setStep] = useState<Step>('email')
  const [pwMode, setPwMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [gender, setGender] = useState<Gender | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!open) return null

  const emailOk = email.includes('@')
  const cleanEmail = email.trim()

  // After a session exists: returning users go straight in, new ones set up
  // their profile (auth.firstName loads async, so read the profile directly).
  const finishAuth = async () => {
    const { data: userData } = await supabase.auth.getUser()
    const { data: profile } = userData.user
      ? await supabase.from('profiles').select('first_name').eq('id', userData.user.id).maybeSingle()
      : { data: null }
    setBusy(false)
    if (profile?.first_name) onSignedIn()
    else setStep('name')
  }

  const run = async (fn: () => Promise<string | null>, onOk: () => void | Promise<void>) => {
    setBusy(true)
    setError(null)
    const err = await fn()
    if (err) {
      setBusy(false)
      setError(err)
      return
    }
    await onOk()
  }

  const submitName = async () => {
    if (!gender) return setError('Pick a gender to continue.')
    await run(
      () => auth.saveProfile({ first_name: name.trim(), gender }),
      () => {
        setBusy(false)
        onSignedIn()
      },
    )
  }

  const inputCls =
    'w-full rounded-xl border border-gray-300 px-4 py-3 text-base outline-none focus:border-gray-900'
  const primaryCls =
    'w-full bg-gray-900 text-white rounded-xl py-3 font-semibold disabled:opacity-40'
  const codeInputCls = `${inputCls} tracking-[0.4em] text-center font-mono text-xl`

  const tabBar = (
    <div className="flex bg-gray-100 rounded-xl p-1 text-sm font-semibold">
      <button
        onClick={() => {
          setStep('email')
          setError(null)
        }}
        className={`flex-1 rounded-lg py-2 ${step === 'email' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
      >
        ✉️ Email code
      </button>
      <button
        onClick={() => {
          setStep('pw')
          setError(null)
        }}
        className={`flex-1 rounded-lg py-2 ${step === 'pw' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
      >
        🔑 Password
      </button>
    </div>
  )

  return (
    <div className="absolute inset-0 z-30 flex items-end sm:items-center sm:justify-center">
      <div className="sheet-backdrop absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="sheet-panel relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-6 pb-8 space-y-4">
        <div className="w-10 h-1 rounded-full bg-gray-300 mx-auto sm:hidden" />

        {(step === 'email' || step === 'pw') && (
          <>
            <h2 className="text-lg font-bold text-gray-900">
              {step === 'pw' && pwMode === 'signup' ? 'Create your account' : "Sign in to Plann'd"}
            </h2>
            {tabBar}
          </>
        )}

        {step === 'email' && (
          <>
            <p className="text-sm text-gray-500">We'll email you a one-time code. No passwords.</p>
            <input
              className={inputCls}
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) =>
                e.key === 'Enter' && emailOk && run(() => auth.sendOtp(cleanEmail), async () => {
                  setBusy(false)
                  setStep('code')
                })
              }
            />
            <button
              onClick={() =>
                run(() => auth.sendOtp(cleanEmail), async () => {
                  setBusy(false)
                  setStep('code')
                })
              }
              disabled={busy || !emailOk}
              className={primaryCls}
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
              className={codeInputCls}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={10}
              placeholder="••••••"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            />
            <button
              onClick={() => run(() => auth.verifyOtp(cleanEmail, code.trim()), finishAuth)}
              disabled={busy || code.length < 6}
              className={primaryCls}
            >
              {busy ? 'Verifying…' : 'Verify'}
            </button>
            <button onClick={() => setStep('email')} className="w-full text-sm text-gray-500">
              Use a different email
            </button>
          </>
        )}

        {step === 'pw' && (
          <>
            <input
              className={inputCls}
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              className={inputCls}
              type="password"
              autoComplete={pwMode === 'signup' ? 'new-password' : 'current-password'}
              placeholder={pwMode === 'signup' ? 'Choose a password (8+ characters)' : 'Password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {pwMode === 'signin' ? (
              <>
                <button
                  onClick={() => run(() => auth.signInPassword(cleanEmail, password), finishAuth)}
                  disabled={busy || !emailOk || password.length < 6}
                  className={primaryCls}
                >
                  {busy ? 'Signing in…' : 'Sign in'}
                </button>
                <div className="flex justify-between text-sm">
                  <button onClick={() => { setPwMode('signup'); setError(null) }} className="text-gray-600 font-semibold">
                    Create account
                  </button>
                  <button onClick={() => { setStep('pw-forgot'); setError(null) }} className="text-gray-500">
                    Forgot password?
                  </button>
                </div>
              </>
            ) : (
              <>
                <button
                  onClick={async () => {
                    if (password.length < 8) return setError('Use at least 8 characters.')
                    setBusy(true)
                    setError(null)
                    const { error: err, needsConfirm } = await auth.signUpPassword(cleanEmail, password)
                    if (err) {
                      setBusy(false)
                      setError(err)
                      return
                    }
                    if (needsConfirm) {
                      setBusy(false)
                      setStep('pw-code')
                    } else {
                      await finishAuth()
                    }
                  }}
                  disabled={busy || !emailOk || !password}
                  className={primaryCls}
                >
                  {busy ? 'Creating…' : 'Create account'}
                </button>
                <button
                  onClick={() => { setPwMode('signin'); setError(null) }}
                  className="w-full text-sm text-gray-500"
                >
                  Already have an account? Sign in
                </button>
              </>
            )}
          </>
        )}

        {step === 'pw-code' && (
          <>
            <h2 className="text-lg font-bold text-gray-900">Confirm your email</h2>
            <p className="text-sm text-gray-500">
              Enter the code sent to <span className="font-medium">{email}</span>
            </p>
            <input
              className={codeInputCls}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={10}
              placeholder="••••••"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            />
            <button
              onClick={() => run(() => auth.verifySignupCode(cleanEmail, code.trim()), finishAuth)}
              disabled={busy || code.length < 6}
              className={primaryCls}
            >
              {busy ? 'Verifying…' : 'Confirm'}
            </button>
          </>
        )}

        {step === 'pw-forgot' && (
          <>
            <h2 className="text-lg font-bold text-gray-900">Reset your password</h2>
            <p className="text-sm text-gray-500">We'll email you a reset code.</p>
            <input
              className={inputCls}
              type="email"
              inputMode="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button
              onClick={() =>
                run(() => auth.sendPasswordReset(cleanEmail), async () => {
                  setBusy(false)
                  setStep('pw-reset')
                })
              }
              disabled={busy || !emailOk}
              className={primaryCls}
            >
              {busy ? 'Sending…' : 'Send reset code'}
            </button>
            <button onClick={() => setStep('pw')} className="w-full text-sm text-gray-500">
              Back to sign in
            </button>
          </>
        )}

        {step === 'pw-reset' && (
          <>
            <h2 className="text-lg font-bold text-gray-900">Set a new password</h2>
            <p className="text-sm text-gray-500">
              Enter the code sent to <span className="font-medium">{email}</span> and your new password.
            </p>
            <input
              className={codeInputCls}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={10}
              placeholder="••••••"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            />
            <input
              className={inputCls}
              type="password"
              autoComplete="new-password"
              placeholder="New password (8+ characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              onClick={() => {
                if (password.length < 8) return setError('Use at least 8 characters.')
                run(() => auth.verifyRecovery(cleanEmail, code.trim(), password), finishAuth)
              }}
              disabled={busy || code.length < 6 || !password}
              className={primaryCls}
            >
              {busy ? 'Updating…' : 'Update password & sign in'}
            </button>
          </>
        )}

        {step === 'name' && (
          <>
            <h2 className="text-lg font-bold text-gray-900">Set up your profile</h2>
            <p className="text-sm text-gray-500">First name only — it's shown on your posts.</p>
            <input
              className={inputCls}
              placeholder="First name"
              value={name}
              maxLength={30}
              onChange={(e) => setName(e.target.value)}
            />
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1.5">Gender</p>
              <div className="flex gap-2">
                {(
                  [
                    ['female', 'Female'],
                    ['male', 'Male'],
                    ['other', 'Other'],
                  ] as [Gender, string][]
                ).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setGender(key)}
                    className={`flex-1 rounded-xl py-2.5 text-sm font-semibold border ${
                      gender === key
                        ? 'bg-gray-900 text-white border-gray-900'
                        : 'bg-white text-gray-700 border-gray-300'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-amber-700">
                ⚠️ Can't be changed later — it keeps women-only plans trustworthy.
              </p>
            </div>
            <button
              onClick={submitName}
              disabled={busy || !name.trim() || !gender}
              className={primaryCls}
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
