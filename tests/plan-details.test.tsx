// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import JoinSection from '../src/components/JoinSection'
import VenueDetails from '../src/components/VenueDetails'
import type { Auth } from '../src/hooks/useAuth'
import type { Intent } from '../src/types'

const mock = vi.hoisted(() => ({
  requests: [] as { id: string; user_id: string; status: string }[],
  insert: vi.fn().mockResolvedValue({ error: null }),
  update: vi.fn(),
  remove: vi.fn(),
  rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  venue: vi.fn().mockResolvedValue(null),
}))
vi.mock('../src/lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const query = {
        select: () => query,
        eq: () => query,
        order: () => query,
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve({
            data: table === 'join_requests' ? mock.requests : [],
            error: null,
          }).then(resolve),
        in: async () => ({ data: [{ id: 'guest', first_name: 'Guest' }] }),
        maybeSingle: async () => ({
          data: table === 'profiles' ? { first_name: 'Jack' } : null,
          error: null,
        }),
        insert: mock.insert,
        update: (...args: unknown[]) => {
          mock.update(...args)
          return query
        },
        delete: (...args: unknown[]) => {
          mock.remove(...args)
          return query
        },
      }
      return query
    },
    rpc: mock.rpc,
    channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
    removeChannel: vi.fn(),
  },
}))
vi.mock('../src/lib/venues', async (original) => ({
  ...(await original<typeof import('../src/lib/venues')>()),
  loadVenue: mock.venue,
  photoUrl: () => 'https://example.com/venue.png',
}))
HTMLDialogElement.prototype.showModal = function () {
  this.open = true
}
HTMLDialogElement.prototype.close = function () {
  this.open = false
}
const plan: Intent = {
  id: 'plan',
  userId: 'host',
  activity: 'coffee',
  title: 'Coffee and work',
  venueName: 'Roastery Coffee House | Vaishali Nagar, 96',
  lat: 26.9,
  lng: 75.8,
  date: '2099-11-05',
  startsAt: '13:30',
  endsAt: '16:30',
  spotsNeeded: 3,
  spotsFilled: 1,
  posterName: 'Jack',
  posterJoinCount: 0,
  womenOnly: false,
  note: 'We pay for our own orders.',
}
const callbacks = () => ({
  onRequestAuth: vi.fn(),
  onEdit: vi.fn(),
  onViewProfile: vi.fn(),
  onOpenChat: vi.fn(),
})
const auth = (id?: string) => ({ session: id ? { user: { id } } : null, gender: 'male' }) as Auth

afterEach(() => {
  cleanup()
  mock.requests = []
  mock.venue.mockResolvedValue(null)
  vi.clearAllMocks()
})

test('guest sees one host row and joining still begins sign-in without sending a request', async () => {
  const user = userEvent.setup(),
    actions = callbacks()
  render(<JoinSection intent={plan} auth={auth()} {...actions} />)
  await user.click(await screen.findByRole('button', { name: 'Request to join' }))
  expect(actions.onRequestAuth).toHaveBeenCalledOnce()
  expect(mock.insert).not.toHaveBeenCalled()
  expect(screen.getAllByText('Hosted by Jack')).toHaveLength(1)
  expect(screen.queryByText('Cost and booking details not added.')).toBeNull()
  expect(
    screen.getByText('The host approves your request. Chat opens once you’re accepted.'),
  ).toBeTruthy()
})

test('host management opens without mutation and cancellation still needs explicit confirmation', async () => {
  const user = userEvent.setup(),
    actions = callbacks()
  render(<JoinSection intent={plan} auth={auth('host')} {...actions} />)
  await user.click(await screen.findByRole('button', { name: 'Open group chat' }))
  expect(actions.onOpenChat).toHaveBeenCalledWith(plan)
  const manage = screen.getByText('Manage plan').closest('details')!
  expect(manage.open).toBe(false)
  await user.click(screen.getByText('Manage plan'))
  expect(manage.open).toBe(true)
  await user.click(screen.getByRole('button', { name: 'Edit plan' }))
  expect(actions.onEdit).toHaveBeenCalledWith(plan)
  await user.click(screen.getByRole('button', { name: 'Cancel plan', exact: true }))
  expect(await screen.findByRole('dialog', { name: 'Cancel this plan?' })).toBeTruthy()
  expect(mock.update).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: 'Go back' }))
  expect(mock.update).not.toHaveBeenCalled()
})

test('pending requests expand automatically and retain the approval action', async () => {
  mock.requests = [{ id: 'request', user_id: 'guest', status: 'pending' }]
  const user = userEvent.setup()
  render(<JoinSection intent={plan} auth={auth('host')} {...callbacks()} />)
  const accept = await screen.findByRole('button', { name: 'Accept', exact: true })
  expect(screen.getByText(/Requests & members/).closest('details')?.open).toBe(true)
  await user.click(accept)
  await waitFor(() =>
    expect(mock.rpc).toHaveBeenCalledWith('respond_to_join_request', {
      p_request_id: 'request',
      p_status: 'accepted',
    }),
  )
})

test('accepted guests can reach contacts, reminders and the leave confirmation', async () => {
  mock.requests = [{ id: 'request', user_id: 'guest', status: 'accepted' }]
  const user = userEvent.setup()
  render(<JoinSection intent={plan} auth={auth('guest')} {...callbacks()} />)
  await screen.findByRole('button', { name: 'Open group chat' })
  await user.click(screen.getByText('Plan tools'))
  expect(screen.getByRole('button', { name: 'Add to calendar' })).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Directions' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Remind me' })).toBeTruthy()
  expect(mock.insert).not.toHaveBeenCalled()
  await user.click(screen.getByText('Contacts & membership'))
  await user.click(screen.getByRole('button', { name: 'Leave plan' }))
  expect(await screen.findByRole('dialog', { name: 'Leave this plan?' })).toBeTruthy()
  expect(mock.remove).not.toHaveBeenCalled()
})

test('venue rating stays visible and its disclosure reveals attributed photos and menu links', async () => {
  mock.venue.mockResolvedValue({
    displayName: { text: 'Roastery' },
    rating: 4.6,
    userRatingCount: 286,
    photos: [
      {
        name: 'photo',
        authorAttributions: [{ displayName: 'Venue owner', uri: 'https://example.com/owner' }],
      },
    ],
    googleMapsUri: 'https://maps.google.com/',
    websiteUri: 'https://example.com/',
  })
  const user = userEvent.setup()
  render(<VenueDetails intent={{ ...plan, venueMenuUrl: 'https://example.com/menu' }} />)
  expect(await screen.findByRole('link', { name: /4.6.*286 reviews.*Google Maps/ })).toBeTruthy()
  const details = screen.getByText('Photos, reviews and menu').closest('details')!
  expect(details.open).toBe(false)
  await user.click(screen.getByText('Photos, reviews and menu'))
  expect(details.open).toBe(true)
  expect(screen.getByRole('img', { name: 'Roastery, venue photo 1' })).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Venue owner' })).toBeTruthy()
  expect(screen.getByRole('link', { name: 'View menu' }).getAttribute('href')).toBe(
    'https://example.com/menu',
  )
})
