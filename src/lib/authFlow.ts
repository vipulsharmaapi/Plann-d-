export type CodeStep = 'code' | 'pw-code' | 'pw-reset'
export interface PendingAuth {
  email: string
  step: CodeStep
  sentAt: number
}
const KEY = 'plannd:pending-email'
const MAX_AGE = 30 * 60 * 1000

// A tab-local checkpoint, never a password, verification code or session token.
export function readPendingAuth(): PendingAuth | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(KEY) || 'null')
    if (
      value &&
      typeof value.email === 'string' &&
      value.email.length <= 254 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email) &&
      ['code', 'pw-code', 'pw-reset'].includes(value.step) &&
      Number.isFinite(value.sentAt) &&
      value.sentAt <= Date.now() &&
      Date.now() - value.sentAt < MAX_AGE
    )
      return { email: value.email, step: value.step, sentAt: value.sentAt }
  } catch {
    /* Storage may be unavailable in an embedded/private browser. */
  }
  return null
}
export function rememberPendingAuth(value: PendingAuth | null) {
  try {
    if (value)
      sessionStorage.setItem(
        KEY,
        JSON.stringify({ email: value.email, step: value.step, sentAt: value.sentAt }),
      )
    else sessionStorage.removeItem(KEY)
  } catch {
    /* Sign-in still works without the optional checkpoint. */
  }
}
export function authErrorMessage(message: string) {
  if (/email.*rate.*limit|over_email_send_rate_limit/i.test(message))
    return 'Email delivery is temporarily at capacity. Please try later, or use Password if you already have one.'
  if (/rate.*limit|too many requests|security purposes/i.test(message))
    return 'Please wait a minute before trying again. If you already received a code, use the most recent one.'
  if (/token.*expired|otp.*expired|invalid.*otp|expired.*invalid/i.test(message))
    return 'That code is invalid or expired. Check the latest email, or request a new code.'
  return message
}
