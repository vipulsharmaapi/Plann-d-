// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AuthSheet from '../src/components/AuthSheet'
import type { Auth } from '../src/hooks/useAuth'
import { readPendingAuth, rememberPendingAuth } from '../src/lib/authFlow'

vi.mock('../src/lib/supabase', () => ({ supabase: { auth: {} } }))
HTMLDialogElement.prototype.showModal = function () {
  this.open = true
}
HTMLDialogElement.prototype.close = function () {
  this.open = false
}
const email = 'tester@example.com'
const makeAuth = () => ({
  sendOtp: vi.fn().mockResolvedValue(null),
  resendSignupCode: vi.fn().mockResolvedValue(null),
  sendPasswordReset: vi.fn().mockResolvedValue(null),
  signUpPassword: vi.fn().mockResolvedValue({ error: null, needsConfirm: true }),
})
function mount(auth: ReturnType<typeof makeAuth>) {
  return render(
    <AuthSheet
      auth={auth as unknown as Auth}
      open
      onClose={vi.fn()}
      onSignedIn={vi.fn()}
      onHelp={vi.fn()}
    />,
  )
}
beforeEach(() => sessionStorage.clear())
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

test('returning from email restores the code step, but never the code or password', async () => {
  const user = userEvent.setup(),
    auth = makeAuth()
  const view = mount(auth)
  await user.type(screen.getByLabelText('Email address'), email)
  await user.click(screen.getByRole('button', { name: 'Send code', exact: true }))
  await user.type(screen.getByLabelText('Verification code'), '12345678')
  view.unmount()
  mount(auth)
  expect(screen.getByRole('heading', { name: 'Check your email' })).toBeTruthy()
  expect((screen.getByLabelText('Verification code') as HTMLInputElement).value).toBe('')
  expect(screen.getByText(email)).toBeTruthy()
  expect(
    (screen.getByRole('button', { name: /Resend code in/ }) as HTMLButtonElement).disabled,
  ).toBe(true)
  expect(auth.sendOtp).toHaveBeenCalledOnce()
  expect(sessionStorage.getItem('plannd:pending-email')).not.toContain('12345678')
})

test('resend uses the original verification method and starts a new cooldown', async () => {
  rememberPendingAuth({ email, step: 'pw-code', sentAt: Date.now() - 61000 })
  const user = userEvent.setup(),
    auth = makeAuth()
  mount(auth)
  await user.click(screen.getByRole('button', { name: 'Resend code', exact: true }))
  expect(auth.resendSignupCode).toHaveBeenCalledWith(email)
  expect(auth.sendOtp).not.toHaveBeenCalled()
  expect(
    (screen.getByRole('button', { name: /Resend code in/ }) as HTMLButtonElement).disabled,
  ).toBe(true)
  await user.click(screen.getByRole('button', { name: 'Use a different email' }))
  expect(readPendingAuth()).toBeNull()
})

test('delivery limits explain the recovery and do not leave a stuck submit button', async () => {
  const user = userEvent.setup(),
    auth = makeAuth()
  auth.sendOtp.mockResolvedValue('email rate limit exceeded')
  mount(auth)
  await user.type(screen.getByLabelText('Email address'), email)
  await user.click(screen.getByRole('button', { name: 'Send code', exact: true }))
  expect(screen.getByRole('alert').textContent).toContain('temporarily at capacity')
  expect(
    (screen.getByRole('button', { name: 'Send code', exact: true }) as HTMLButtonElement).disabled,
  ).toBe(false)
})

test('a failed password signup releases the form for another attempt', async () => {
  const user = userEvent.setup(),
    auth = makeAuth()
  auth.signUpPassword.mockRejectedValue(new Error('Network unavailable'))
  mount(auth)
  await user.click(screen.getByRole('button', { name: '🔑 Password' }))
  await user.click(screen.getByRole('button', { name: 'Create account', exact: true }))
  await user.type(screen.getByLabelText('Email address'), email)
  await user.type(screen.getByLabelText('Password'), 'fictional-test-password')
  await user.click(screen.getByRole('button', { name: 'Create account', exact: true }))
  expect(screen.getByRole('alert').textContent).toContain('Could not connect')
  expect(
    (screen.getByRole('button', { name: 'Create account', exact: true }) as HTMLButtonElement)
      .disabled,
  ).toBe(false)
  expect(auth.signUpPassword).toHaveBeenCalledOnce()
})

test('opening a plan in another browser copies only its public URL', async () => {
  const user = userEvent.setup(),
    auth = makeAuth()
  const id = '20000000-0000-4000-8000-000000000001'
  history.replaceState(null, '', `/?p=${id}&access_token=fictional#refresh_token=fictional`)
  try {
    mount(auth)
    await user.click(screen.getByText('Trouble signing in?'))
    await user.click(screen.getByRole('button', { name: 'Copy link for another browser' }))
    expect(await navigator.clipboard.readText()).toBe(`${location.origin}/?p=${id}`)
  } finally {
    history.replaceState(null, '', '/')
  }
})

test('expired, malformed and unavailable checkpoint storage never break sign-in', () => {
  rememberPendingAuth({ email, step: 'code', sentAt: Date.now() - 31 * 60 * 1000 })
  expect(readPendingAuth()).toBeNull()
  sessionStorage.setItem('plannd:pending-email', '{broken')
  expect(readPendingAuth()).toBeNull()
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('blocked')
  })
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('blocked')
  })
  expect(readPendingAuth()).toBeNull()
  expect(() => rememberPendingAuth({ email, step: 'code', sentAt: Date.now() })).not.toThrow()
})
