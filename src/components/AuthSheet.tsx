import Sheet from './Sheet'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Auth, Gender } from '../hooks/useAuth'
import {
  authErrorMessage,
  readPendingAuth,
  rememberPendingAuth,
  type CodeStep,
} from '../lib/authFlow'

interface Props {
  auth: Auth
  open: boolean
  onClose: () => void
  onSignedIn: () => void
  onHelp: () => void
}

type Step = 'email' | 'code' | 'pw' | 'pw-code' | 'pw-forgot' | 'pw-reset' | 'name' | 'profile'

export default function AuthSheet({ auth, open, onClose, onSignedIn, onHelp }: Props) {
  const [pending] = useState(readPendingAuth)
  const [step, setStep] = useState<Step>(pending?.step ?? 'email')
  const [pwMode, setPwMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState(pending?.email ?? '')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [gender, setGender] = useState<Gender | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false)
  const [sentAt, setSentAt] = useState(pending?.sentAt ?? 0)
  const [sentTo, setSentTo] = useState(pending?.email ?? '')
  const [now, setNow] = useState(Date.now)
  const [notice, setNotice] = useState('')
  const [linkFallback, setLinkFallback] = useState('')
  const resendWait = Math.max(0, Math.ceil((sentAt + 60000 - now) / 1000))
  useEffect(() => {
    if (!resendWait) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [resendWait])

  if (!open) return null

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const cleanEmail = email.trim()

  // After a session exists: returning users go straight in, new ones set up
  // their profile (auth.firstName loads async, so read the profile directly).
  const finishAuth = async () => {
    setStep('profile')
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData.user) throw new Error('Could not confirm your session. Try again.')
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('first_name')
      .eq('id', userData.user.id)
      .maybeSingle()
    if (profileError) throw new Error('Could not load your profile. Try again.')
    rememberPendingAuth(null)
    if (profile?.first_name) onSignedIn()
    else setStep('name')
  }

  const run = async (fn: () => Promise<string | null>, onOk: () => void | Promise<void>) => {
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true)
    setError(null)
    setNotice('')
    try {
      const err = await fn()
      if (err) setError(authErrorMessage(err))
      else await onOk()
    } catch {
      setError('Could not connect. Please try again.')
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  function codeSent(nextStep: CodeStep) {
    const time = Date.now()
    setSentAt(time)
    setSentTo(cleanEmail)
    setNow(time)
    setCode('')
    setStep(nextStep)
    rememberPendingAuth({ email: cleanEmail, step: nextStep, sentAt: time })
    setNotice('Code sent. Check your inbox and spam folder.')
  }
  function changeEmail() {
    rememberPendingAuth(null)
    setCode('')
    setPassword('')
    setError(null)
    setNotice('')
    setStep('email')
  }
  const codeHelp = (codeStep: CodeStep) => (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">
        Check your spam folder, then return to this tab. If it reloads, choose Sign in to continue
        with the latest code.
      </p>
      <button
        className="secondary w-full"
        disabled={busy || resendWait > 0}
        onClick={() =>
          run(
            () =>
              codeStep === 'code'
                ? auth.sendOtp(cleanEmail)
                : codeStep === 'pw-code'
                  ? auth.resendSignupCode(cleanEmail)
                  : auth.sendPasswordReset(cleanEmail),
            () => codeSent(codeStep),
          )
        }
      >
        {resendWait > 0 ? `Resend code in ${resendWait}s` : 'Resend code'}
      </button>
      <button
        onClick={changeEmail}
        disabled={busy}
        className="w-full text-sm text-gray-600 underline"
      >
        Use a different email
      </button>
      <button
        disabled={busy}
        className="w-full text-sm text-gray-600 underline"
        onClick={() => {
          changeEmail()
          setStep('pw')
          setPwMode('signin')
        }}
      >
        Use password instead
      </button>
    </div>
  )

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
          changeEmail()
        }}
        className={`flex-1 rounded-lg py-2 ${step === 'email' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
      >
        ✉️ Email code
      </button>
      <button
        onClick={() => {
          setStep('pw')
          rememberPendingAuth(null)
          setError(null)
        }}
        className={`flex-1 rounded-lg py-2 ${step === 'pw' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
      >
        🔑 Password
      </button>
    </div>
  )

  return (
    <Sheet title="Sign in" onClose={onClose}>
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
            <p className="text-sm text-gray-600">
              New here? This also creates your account. We'll email you a one-time code.
            </p>
            <label className="field">
              Email address
              <input
                className={inputCls}
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) =>
                  e.key === 'Enter' &&
                  emailOk &&
                  !(resendWait > 0 && sentTo === cleanEmail) &&
                  run(
                    () => auth.sendOtp(cleanEmail),
                    () => codeSent('code'),
                  )
                }
              />
            </label>
            <button
              onClick={() =>
                run(
                  () => auth.sendOtp(cleanEmail),
                  () => codeSent('code'),
                )
              }
              disabled={busy || !emailOk || (resendWait > 0 && sentTo === cleanEmail)}
              className={primaryCls}
            >
              {busy
                ? 'Sending…'
                : resendWait > 0 && sentTo === cleanEmail
                  ? `Send code in ${resendWait}s`
                  : 'Send code'}
            </button>
          </>
        )}

        {step === 'code' && (
          <>
            <h2 className="text-lg font-bold text-gray-900">Check your email</h2>
            <p className="text-sm text-gray-500">
              Enter the code sent to <span className="font-medium break-all">{email}</span>
            </p>
            <label className="field">
              Verification code
              <input
                className={codeInputCls}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={10}
                placeholder="••••••"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              />
            </label>
            <button
              onClick={() => run(() => auth.verifyOtp(cleanEmail, code.trim()), finishAuth)}
              disabled={busy || code.length < 6}
              className={primaryCls}
            >
              {busy ? 'Please wait…' : 'Verify'}
            </button>
            {codeHelp('code')}
          </>
        )}

        {step === 'pw' && (
          <>
            <label className="field">
              Email address
              <input
                className={inputCls}
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="field">
              Password
              <input
                className={inputCls}
                type="password"
                autoComplete={pwMode === 'signup' ? 'new-password' : 'current-password'}
                placeholder={pwMode === 'signup' ? 'Choose a password (8+ characters)' : 'Password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
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
                  <button
                    onClick={() => {
                      setPwMode('signup')
                      setError(null)
                    }}
                    className="text-gray-600 font-semibold"
                  >
                    Create account
                  </button>
                  <button
                    onClick={() => {
                      setStep('pw-forgot')
                      setError(null)
                    }}
                    className="text-gray-500"
                  >
                    Forgot password?
                  </button>
                </div>
              </>
            ) : (
              <>
                <button
                  onClick={() => {
                    if (password.length < 8) return setError('Use at least 8 characters.')
                    let needsConfirm = false
                    void run(
                      async () => {
                        const result = await auth.signUpPassword(cleanEmail, password)
                        needsConfirm = result.needsConfirm
                        return result.error
                      },
                      async () => {
                        setPassword('')
                        if (needsConfirm) codeSent('pw-code')
                        else await finishAuth()
                      },
                    )
                  }}
                  disabled={busy || !emailOk || !password}
                  className={primaryCls}
                >
                  {busy ? 'Creating…' : 'Create account'}
                </button>
                <button
                  onClick={() => {
                    setPwMode('signin')
                    setError(null)
                  }}
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
              Enter the code sent to <span className="font-medium break-all">{email}</span>
            </p>
            <label className="field">
              Verification code
              <input
                className={codeInputCls}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={10}
                placeholder="••••••"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              />
            </label>
            <button
              onClick={() => run(() => auth.verifySignupCode(cleanEmail, code.trim()), finishAuth)}
              disabled={busy || code.length < 6}
              className={primaryCls}
            >
              {busy ? 'Please wait…' : 'Confirm'}
            </button>
            {codeHelp('pw-code')}
          </>
        )}

        {step === 'pw-forgot' && (
          <>
            <h2 className="text-lg font-bold text-gray-900">Reset your password</h2>
            <p className="text-sm text-gray-500">We'll email you a reset code.</p>
            <label className="field">
              Email address
              <input
                className={inputCls}
                type="email"
                inputMode="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <button
              onClick={() =>
                run(
                  () => auth.sendPasswordReset(cleanEmail),
                  () => codeSent('pw-reset'),
                )
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
              Enter the code sent to <span className="font-medium break-all">{email}</span> and your
              new password.
            </p>
            <label className="field">
              Verification code
              <input
                className={codeInputCls}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={10}
                placeholder="••••••"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              />
            </label>
            <label className="field">
              Password
              <input
                className={inputCls}
                type="password"
                autoComplete="new-password"
                placeholder="New password (8+ characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <button
              onClick={() => {
                if (password.length < 8) return setError('Use at least 8 characters.')
                run(() => auth.verifyRecovery(cleanEmail, code.trim(), password), finishAuth)
              }}
              disabled={busy || code.length < 6 || !password}
              className={primaryCls}
            >
              {busy ? 'Please wait…' : 'Update password & sign in'}
            </button>
            {codeHelp('pw-reset')}
          </>
        )}

        {step === 'profile' && (
          <>
            <h2 className="text-lg font-bold">Finishing sign-in</h2>
            <p className="text-sm text-gray-600">
              Your account is signed in. We’re loading your profile.
            </p>
            <button
              className={primaryCls}
              disabled={busy}
              onClick={() => run(async () => null, finishAuth)}
            >
              {busy ? 'Loading…' : 'Retry loading profile'}
            </button>
          </>
        )}

        {step === 'name' && (
          <>
            <h2 className="text-lg font-bold text-gray-900">Set up your profile</h2>
            <p className="text-sm text-gray-500">First name only — it's shown on your posts.</p>
            <label className="field">
              First name
              <input
                className={inputCls}
                placeholder="First name"
                value={name}
                maxLength={30}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
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
                    aria-pressed={gender === key}
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
                Gender is self-declared, not identity verification. You can request a correction in
                Help.
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

        <details className="text-sm text-gray-700 space-y-3">
          <summary className="cursor-pointer underline">Trouble signing in?</summary>
          <p>
            If you opened Plann’d inside Instagram or another app, try this link in Safari or Chrome
            and sign in there.
          </p>
          <button
            className="secondary w-full"
            type="button"
            onClick={async () => {
              const id = new URLSearchParams(location.search).get('p')
              const link = `${location.origin}/${id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ? `?p=${id}` : ''}`
              try {
                await navigator.clipboard.writeText(link)
                setNotice('Link copied. Paste it into Safari or Chrome.')
              } catch {
                setLinkFallback(link)
              }
            }}
          >
            Copy link for another browser
          </button>
          {linkFallback && (
            <label className="field">
              Select and copy this link
              <input
                className={inputCls}
                value={linkFallback}
                readOnly
                onFocus={(e) => e.currentTarget.select()}
              />
            </label>
          )}
        </details>

        <button type="button" onClick={onHelp} className="secondary w-full text-sm">
          Help, privacy & safety
        </button>

        {notice && (
          <p role="status" className="text-sm text-gray-700">
            {notice}
          </p>
        )}

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
      </div>
    </Sheet>
  )
}
