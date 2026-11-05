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
  expect((screen.getByLabelText('Activity') as HTMLSelectElement).value).toBe('coffee')
  expect((screen.getByLabelText('Venue') as HTMLInputElement).value).toBe('Test café, Civil Lines')
  expect(supabase.rpc).not.toHaveBeenCalled()
  await user.type(screen.getByLabelText('What’s the plan?'), 'QA venue discovery test')
  const tomorrow = new Date(Date.now() + 86400000).toLocaleDateString('en-CA', {
    timeZone: 'Asia/Kolkata',
  })
  fireEvent.change(screen.getByLabelText('Date'), { target: { value: tomorrow } })
  fireEvent.change(screen.getByLabelText('Starts at'), { target: { value: '17:00' } })
  fireEvent.change(screen.getByLabelText('Ends at'), { target: { value: '18:00' } })
  await user.click(screen.getByRole('button', { name: 'Post your plan' }))
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

test('changing a prefilled venue clears the old coordinates and blocks a mismatched post', async () => {
  const user = userEvent.setup()
  render(
    <PostSheet
      open
      session={{ user: { id: 'test-host' } } as Session}
      firstName="Test"
      onClose={vi.fn()}
      onPosted={vi.fn()}
      venuePrefill={{
        activity: 'coffee',
        venueName: 'Original venue',
        googlePlaceId: 'ChIJoldvenue',
        lat: 26.9,
        lng: 75.8,
      }}
    />,
  )
  await user.type(screen.getByLabelText('What’s the plan?'), 'Coffee tomorrow')
  await user.clear(screen.getByLabelText('Venue'))
  await user.type(screen.getByLabelText('Venue'), 'A')
  await user.click(screen.getByRole('button', { name: 'Post your plan' }))
  expect(screen.getByRole('alert').textContent).toContain('Choose a venue from the search results')
  expect(supabase.rpc).not.toHaveBeenCalled()
})

test('a Google result submits its place identity and IST times, and a failed save retains the draft', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue({
      ok: true,
      json: async () => ({
        places: [
          {
            id: 'ChIJchosenvenue',
            displayName: { text: 'Chosen café' },
            formattedAddress: 'Civil Lines, Jaipur',
            location: { latitude: 26.91, longitude: 75.79 },
          },
        ],
      }),
    })
  vi.stubGlobal('fetch', fetcher)
  vi.mocked(supabase.rpc)
    .mockResolvedValueOnce({ error: { message: 'Please try again' } } as never)
    .mockResolvedValueOnce({ error: null } as never)
  const posted = vi.fn(),
    user = userEvent.setup()
  render(
    <PostSheet
      open
      session={{ user: { id: 'test-host' } } as Session}
      firstName="Test"
      onClose={vi.fn()}
      onPosted={posted}
    />,
  )
  await user.type(screen.getByLabelText('What’s the plan?'), 'Coffee tomorrow')
  await user.type(screen.getByLabelText('Venue'), 'Chosen café')
  await user.click(await screen.findByRole('button', { name: /Chosen café.*Civil Lines, Jaipur/ }))
  const tomorrow = new Date(Date.now() + 86400000).toLocaleDateString('en-CA', {
    timeZone: 'Asia/Kolkata',
  })
  fireEvent.change(screen.getByLabelText('Date'), { target: { value: tomorrow } })
  fireEvent.change(screen.getByLabelText('Starts at'), { target: { value: '13:30' } })
  fireEvent.change(screen.getByLabelText('Ends at'), { target: { value: '16:00' } })
  await user.click(screen.getByRole('button', { name: 'Post your plan' }))
  expect((await screen.findByRole('alert')).textContent).toBe('Please try again')
  expect((screen.getByLabelText('Venue') as HTMLInputElement).value).toBe('Chosen café')
  await user.click(screen.getByRole('button', { name: 'Post your plan' }))
  await waitFor(() => expect(posted).toHaveBeenCalledOnce())
  expect(supabase.rpc).toHaveBeenLastCalledWith(
    'save_plan',
    expect.objectContaining({
      p_id: vi.mocked(supabase.rpc).mock.calls[0][1]?.p_id,
      p_plan: expect.objectContaining({
        google_place_id: 'ChIJchosenvenue',
        lat: 26.91,
        lng: 75.79,
        starts_at: `${tomorrow}T08:00:00.000Z`,
        ends_at: `${tomorrow}T10:30:00.000Z`,
      }),
    }),
  )
  expect(
    fetcher.mock.calls.every(
      ([url]) => url === 'https://places.googleapis.com/v1/places:searchText',
    ),
  ).toBe(true)
  vi.unstubAllGlobals()
})
