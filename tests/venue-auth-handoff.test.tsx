// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { VenueDraft } from '../src/types'
import App from '../src/App'

const { auth } = vi.hoisted(() => ({ auth: { session: null as object | null, firstName: 'Test' } }))
vi.mock('../src/hooks/useAuth', () => ({ useAuth: () => auth }))
vi.mock('../src/hooks/useIntents', () => ({
  useIntents: () => ({ intents: [], source: 'live', refresh: vi.fn() }),
}))
vi.mock('../src/hooks/useNotifications', () => ({
  useNotifications: () => ({ items: [], unread: 0 }),
}))
vi.mock('../src/components/Explore', () => ({
  default: ({
    onVenuePost,
    onPost,
  }: {
    onVenuePost: (draft: VenueDraft) => void
    onPost: () => void
  }) => (
    <>
      <button
        onClick={() =>
          onVenuePost({
            activity: 'football',
            venueName: 'Selected turf',
            googlePlaceId: 'ChIJtestturf123',
            lat: 26.9,
            lng: 75.8,
          })
        }
      >
        Choose test turf
      </button>
      <button onClick={onPost}>Post without a venue</button>
    </>
  ),
}))
vi.mock('../src/components/AuthSheet', () => ({
  default: ({ onSignedIn }: { onSignedIn: () => void }) => (
    <button
      onClick={() => {
        auth.session = { user: { id: 'test' } }
        onSignedIn()
      }}
    >
      Complete test sign-in
    </button>
  ),
}))
vi.mock('../src/components/PostSheet', () => ({
  default: ({
    venuePrefill,
    onClose,
  }: {
    venuePrefill: VenueDraft | null
    onClose: () => void
  }) => (
    <div role="dialog" aria-label="Draft">
      <p>{venuePrefill ? JSON.stringify(venuePrefill) : 'No venue selected'}</p>
      <button onClick={onClose}>Close draft</button>
    </div>
  ),
}))
afterEach(() => {
  cleanup()
  history.replaceState(null, '', '/')
  sessionStorage.clear()
  auth.session = null
})

test('guest sign-in retains the chosen venue; a later blank post does not reuse it', async () => {
  const user = userEvent.setup()
  render(<App />)
  await user.click(screen.getByRole('button', { name: 'Choose test turf' }))
  expect(screen.queryByRole('dialog', { name: 'Draft' })).toBeNull()
  await user.click(await screen.findByRole('button', { name: 'Complete test sign-in' }))
  expect((await screen.findByRole('dialog', { name: 'Draft' })).textContent).toContain(
    'ChIJtestturf123',
  )
  expect(screen.getByRole('dialog').textContent).toContain('football')
  await user.click(screen.getByRole('button', { name: 'Close draft' }))
  await user.click(screen.getByRole('button', { name: 'Post without a venue' }))
  expect((await screen.findByRole('dialog', { name: 'Draft' })).textContent).toContain(
    'No venue selected',
  )
})
