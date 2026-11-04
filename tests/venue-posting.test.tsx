// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Session } from '@supabase/supabase-js'
import PostSheet from '../src/components/PostSheet'
import { supabase } from '../src/lib/supabase'

vi.mock('../src/lib/supabase', () => ({
  supabase: { rpc: vi.fn().mockResolvedValue({ error: null }) },
}))
vi.mock('../src/lib/googleMaps', () => ({
  GOOGLE_MAP_ID: 'test',
  loadGoogleMaps: () => new Promise(() => {}),
  onGoogleAuthFailure: () => () => {},
}))
HTMLDialogElement.prototype.showModal = function () {
  this.open = true
}
HTMLDialogElement.prototype.close = function () {
  this.open = false
}
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

test('a discovered venue prefills the real editor and save_plan receives its exact location and category', async () => {
  const onPosted = vi.fn(),
    user = userEvent.setup()
  render(
    <PostSheet
      open
      session={{ user: { id: 'test-host' } } as Session}
      firstName="Test"
      onClose={vi.fn()}
      onPosted={onPosted}
      venuePrefill={{
        activity: 'coffee',
        venueName: 'Test café, Civil Lines',
        googlePlaceId: 'ChIJtestcafe456',
        lat: 26.91,
        lng: 75.79,
      }}
    />,
  )
  expect((screen.getByLabelText("What's the plan?") as HTMLSelectElement).value).toBe('coffee')
  expect((screen.getByLabelText('Meeting venue') as HTMLInputElement).value).toBe(
    'Test café, Civil Lines',
  )
  expect(supabase.rpc).not.toHaveBeenCalled()
  await user.type(screen.getByLabelText('Plan title'), 'QA venue discovery test')
  const tomorrow = new Date(Date.now() + 86400000).toLocaleDateString('en-CA', {
    timeZone: 'Asia/Kolkata',
  })
  fireEvent.change(screen.getByLabelText('When?'), { target: { value: tomorrow } })
  fireEvent.change(screen.getByLabelText('From'), { target: { value: '17:00' } })
  fireEvent.change(screen.getByLabelText('Till'), { target: { value: '18:00' } })
  await user.click(screen.getByRole('button', { name: 'Post it 🙌' }))
  await waitFor(() => expect(onPosted).toHaveBeenCalledOnce())
  expect(supabase.rpc).toHaveBeenCalledWith(
    'save_plan',
    expect.objectContaining({
      p_plan: expect.objectContaining({
        activity: 'coffee',
        venue_name: 'Test café, Civil Lines',
        google_place_id: 'ChIJtestcafe456',
        lat: 26.91,
        lng: 75.79,
      }),
    }),
  )
})
