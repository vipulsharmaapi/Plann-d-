// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Session } from '@supabase/supabase-js'
import PostSheet from '../src/components/PostSheet'
import MyPlans from '../src/components/MyPlans'
import NotificationsSheet from '../src/components/NotificationsSheet'
import Avatar from '../src/components/Avatar'
import { publishProfile } from '../src/lib/profiles'
import { discoverVenues, isDiscoverableVenue } from '../src/lib/venues'
import { VenueRow } from '../src/components/VenuePresentation'

vi.mock('../src/lib/supabase', () => ({
  supabase: {
    rpc: vi.fn().mockResolvedValue({ error: null }),
    from: vi.fn(() => ({ select: () => ({ in: () => Promise.resolve({ data: [] }) }) })),
  },
}))
vi.mock('../src/lib/venues', async (original) => ({
  ...(await original<typeof import('../src/lib/venues')>()),
  discoverVenues: vi.fn(),
}))
vi.mock('../src/components/VenuePinMap', () => ({ default: () => null }))
HTMLDialogElement.prototype.showModal = function () {
  this.open = true
}
HTMLDialogElement.prototype.close = function () {
  this.open = false
}
const places = [
  {
    id: 'ChIJfirstbranch',
    displayName: { text: 'A café' },
    formattedAddress: 'Civil Lines, Jaipur',
    location: { latitude: 26.91, longitude: 75.79 },
  },
  {
    id: 'ChIJsecondbranch',
    displayName: { text: 'A café' },
    formattedAddress: 'Mansarovar, Jaipur',
    location: { latitude: 26.85, longitude: 75.76 },
  },
]
afterEach(() => {
  cleanup()
  history.replaceState(null, '', '/')
  vi.clearAllMocks()
})
test('picker cancel and browser Back preserve every draft field; confirmation changes only the venue', async () => {
  vi.mocked(discoverVenues).mockResolvedValue({ places })
  const user = userEvent.setup()
  render(
    <PostSheet
      open
      session={{ user: { id: 'draft-test' } } as Session}
      firstName="Test"
      onClose={vi.fn()}
      onPosted={vi.fn()}
      venuePrefill={{
        activity: 'football',
        venueName: 'Original place',
        googlePlaceId: 'ChIJoriginalvenue',
        venueArea: 'Civil Lines',
        lat: 26.91,
        lng: 75.79,
      }}
    />,
  )
  await user.type(screen.getByLabelText('What’s the plan?'), 'A friendly game')
  await user.selectOptions(screen.getByLabelText('Open spots'), '6')
  await user.type(screen.getByLabelText('A little about your plan'), 'Bring water')
  await user.click(screen.getByText(/More details/))
  await user.type(screen.getByLabelText('Expected cost per person (₹)'), '250')
  await user.selectOptions(screen.getByLabelText('Skill level'), 'beginner')
  const snapshot = () =>
    Object.fromEntries(
      [
        ...document.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
          '.post-form input,.post-form select,.post-form textarea',
        ),
      ].map((input, i) => [input.name || i, input.value]),
    )
  const before = snapshot()
  await user.click(screen.getByRole('button', { name: 'Change venue' }))
  expect(screen.getAllByRole('dialog')).toHaveLength(1)
  expect(
    (screen.getByRole('button', { name: 'Use this venue' }) as HTMLButtonElement).disabled,
  ).toBe(true)
  await user.click(await screen.findByRole('button', { name: 'Select A café in Mansarovar' }))
  await user.click(screen.getByRole('button', { name: 'Cancel' }))
  await waitFor(() => expect(screen.queryByRole('heading', { name: 'Choose a venue' })).toBeNull())
  expect(snapshot()).toEqual(before)
  await user.click(screen.getByRole('button', { name: 'Change venue' }))
  await screen.findByRole('button', { name: 'Select A café in Civil Lines' })
  act(() => history.back())
  await waitFor(() => expect(screen.queryByRole('heading', { name: 'Choose a venue' })).toBeNull())
  expect(snapshot()).toEqual(before)
  await user.click(screen.getByRole('button', { name: 'Change venue' }))
  await user.click(await screen.findByRole('button', { name: 'Select A café in Mansarovar' }))
  await user.click(screen.getByRole('button', { name: 'Use this venue' }))
  await waitFor(() => expect(screen.queryByRole('heading', { name: 'Choose a venue' })).toBeNull())
  expect(snapshot()).toEqual({ ...before, venue: 'A café', area: 'Mansarovar' })
})
test('missing coordinates retain a Jaipur venue row and missing facts stay absent', () => {
  const place = {
    id: 'ChIJmissinglocation',
    displayName: { text: 'A Jaipur venue' },
    formattedAddress: 'Jaipur, Rajasthan',
  }
  expect(isDiscoverableVenue(place)).toBe(true)
  expect(isDiscoverableVenue({ ...place, formattedAddress: 'Delhi' })).toBe(false)
  render(<VenueRow place={place} selected={false} onSelect={vi.fn()} />)
  expect(screen.getByRole('button', { name: 'Select A Jaipur venue' })).toBeTruthy()
  expect(screen.queryByText(/reviews/)).toBeNull()
  expect(screen.getByLabelText('No venue photo')).toBeTruthy()
})
test('one canonical profile updates every avatar immediately and image failure falls back', async () => {
  publishProfile('photo-test', {
    first_name: 'Aditi Sharma',
    emoji: '☕',
    avatar_url: 'https://example.com/old.jpg',
  })
  const view = render(
    <>
      <Avatar userId="photo-test" />
      <Avatar userId="photo-test" />
    </>,
  )
  expect([...view.container.querySelectorAll('img')].map((i) => i.src)).toEqual([
    'https://example.com/old.jpg',
    'https://example.com/old.jpg',
  ])
  act(() => publishProfile('photo-test', { avatar_url: 'https://example.com/new.jpg' }))
  expect(
    [...view.container.querySelectorAll('img')].every(
      (i) => i.src === 'https://example.com/new.jpg',
    ),
  ).toBe(true)
  fireEvent.error(view.container.querySelector('img')!)
  expect(view.container.textContent).toContain('☕')
  act(() => publishProfile('photo-test', { avatar_url: null, emoji: '🙋' }))
  expect(view.container.querySelector('img')).toBeNull()
  expect(view.container.textContent).toBe('ASAS')
})
test('unresolved sessions never flash signed-out gates and guest pages stay uncluttered', () => {
  const props = { onSignIn: vi.fn(), onExplore: vi.fn(), onOpen: vi.fn(), onPost: vi.fn() }
  const view = render(<MyPlans {...props} sessionLoading />)
  expect(screen.queryByRole('button', { name: 'Sign in' })).toBeNull()
  view.rerender(<MyPlans {...props} />)
  expect(screen.getByRole('heading', { name: 'Keep your plans in one place.' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Upcoming' })).toBeNull()
  view.unmount()
  render(
    <NotificationsSheet
      signedIn={false}
      state="loading"
      items={[]}
      onOpenNotification={vi.fn()}
      onMarkAll={vi.fn()}
      onRetry={vi.fn()}
      onSignIn={vi.fn()}
      onExplore={vi.fn()}
    />,
  )
  expect(screen.getByRole('heading', { name: 'Your conversations start here.' })).toBeTruthy()
  expect(screen.queryByText(/Reminders appear here/)).toBeNull()
})
test('signed-in inbox failure offers retry, never a sign-in gate', () => {
  render(
    <NotificationsSheet
      signedIn
      state="error"
      items={[]}
      onOpenNotification={vi.fn()}
      onMarkAll={vi.fn()}
      onRetry={vi.fn()}
      onSignIn={vi.fn()}
      onExplore={vi.fn()}
    />,
  )
  expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Sign in' })).toBeNull()
})
