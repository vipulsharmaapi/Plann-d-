// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { matchesPlan, plansAtVenue, activeCategories } from '../src/lib/planDiscovery'
import { navigate, readAuthIntent, rememberAuthIntent } from '../src/lib/navigation'
import { VenueResults } from '../src/components/VenueDiscovery'
import HelpSheet from '../src/components/HelpSheet'
import App from '../src/App'
import type { Intent } from '../src/types'

const { plan, discover, fetchPlan } = vi.hoisted(() => ({
  plan: {
    id: '20000000-0000-4000-8000-000000000091',
    userId: 'host',
    activity: 'coffee',
    title: 'Coffee after work',
    venueName: 'Public café',
    venueArea: 'Vaishali Nagar',
    googlePlaceId: 'ChIJtestcafe123',
    date: '2026-11-05',
    startsAt: '19:00',
    endsAt: '20:00',
    spotsNeeded: 3,
    spotsFilled: 1,
    lat: 26.9,
    lng: 75.8,
    posterName: 'Host',
    posterJoinCount: 0,
    womenOnly: false,
  } as Intent,
  discover: vi.fn(),
  fetchPlan: vi.fn(),
}))
vi.mock('../src/lib/venues', async (original) => ({
  ...(await original<typeof import('../src/lib/venues')>()),
  discoverVenues: discover,
}))
vi.mock('../src/hooks/usePhone', () => ({ usePhone: () => true }))
vi.mock('../src/hooks/useAuth', () => ({ useAuth: () => ({ session: null }) }))
vi.mock('../src/hooks/useIntents', () => ({
  INTENT_COLUMNS: '*',
  rowToIntent: (row: Intent) => row,
  useIntents: () => ({ intents: [plan], source: 'live', refresh: vi.fn() }),
}))
vi.mock('../src/hooks/useNotifications', () => ({
  useNotifications: () => ({ items: [], unread: 0 }),
}))
vi.mock('../src/components/JaipurMap', () => ({ default: () => <p>Plan map content</p> }))
vi.mock('../src/components/VenueMap', () => ({ default: () => <p>Venue map content</p> }))
vi.mock('../src/components/JoinSection', () => ({
  default: () => <p>Review then request to join</p>,
}))
vi.mock('../src/components/VenueDetails', () => ({ default: () => null }))
vi.mock('../src/lib/supabase', () => ({
  supabase: {
    channel: () => ({ on: () => ({ subscribe: vi.fn() }) }),
    removeChannel: vi.fn(),
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: fetchPlan }) }) }),
  },
}))
HTMLDialogElement.prototype.showModal = function () {
  this.open = true
}
HTMLDialogElement.prototype.close = function () {
  this.open = false
}
window.scrollTo = vi.fn()
afterEach(() => {
  cleanup()
  history.replaceState(null, '', '/')
  sessionStorage.clear()
  vi.clearAllMocks()
})
const place = {
  id: plan.googlePlaceId!,
  displayName: { text: plan.venueName },
  location: { latitude: plan.lat, longitude: plan.lng },
}

test('neighbourhood matches independently of the title/name, accent-insensitively; live categories come first', () => {
  expect(matchesPlan(plan, 'café vaishali')).toBe(true)
  expect(matchesPlan(plan, 'Mansarovar')).toBe(false)
  expect(activeCategories([plan])[0].key).toBe('coffee')
})
test('venue plans match the exact branch and exclude ended/cancelled plans', () => {
  expect(
    plansAtVenue(
      [
        plan,
        { ...plan, id: 'other', googlePlaceId: 'ChIJotherbranch' },
        { ...plan, id: 'cancelled', status: 'cancelled' },
        { ...plan, id: 'ended', endsAtIso: '2020-01-01T00:00:00Z' },
      ],
      place.id,
    ),
  ).toEqual([plan])
})
test('a venue result opens an existing plan without creating another', async () => {
  discover.mockResolvedValue({ places: [place] })
  const open = vi.fn(),
    post = vi.fn(),
    user = userEvent.setup()
  render(
    <VenueResults
      search={{ query: 'coffee', area: '' }}
      intents={[plan]}
      onPost={post}
      onOpenPlan={open}
    />,
  )
  await user.click(await screen.findByRole('button', { name: 'View plan: Coffee after work' }))
  expect(open).toHaveBeenCalledWith(plan)
  expect(post).not.toHaveBeenCalled()
})
test('legacy plans need both the full venue name and a point within 100 metres', () => {
  const legacy = { ...plan, googlePlaceId: undefined, venueName: 'Public café, 96' }
  expect(plansAtVenue([legacy], place.id, place)).toEqual([legacy])
  expect(plansAtVenue([{ ...legacy, lat: plan.lat + 0.02 }], place.id, place)).toEqual([])
  expect(
    plansAtVenue([{ ...legacy, venueName: 'Public café other branch' }], place.id, place),
  ).toEqual([])
  expect(plansAtVenue([{ ...legacy, googlePlaceId: 'ChIJotherbranch' }], place.id, place)).toEqual(
    [],
  )
})
test('venue search and list survive main navigation without a second request', async () => {
  discover.mockResolvedValue({ places: [place] })
  history.replaceState(null, '', '/?browse=search&q=Cafés&area=Vaishali+Nagar')
  const user = userEvent.setup()
  render(<App />)
  await screen.findByRole('button', { name: 'View plan: Coffee after work' })
  await user.click(screen.getAllByRole('button', { name: 'My plans' })[0])
  expect(screen.queryByRole('button', { name: 'View plan: Coffee after work' })).toBeNull()
  await user.click(screen.getAllByRole('button', { name: 'Explore', exact: true })[0])
  expect(screen.getByRole('button', { name: 'View plan: Coffee after work' })).toBeTruthy()
  expect(new URLSearchParams(location.search).get('q')).toBe('Cafés')
  expect(discover).toHaveBeenCalledOnce()
})
test('browser Back closes a plan to the previous filtered view', async () => {
  const user = userEvent.setup()
  history.replaceState(null, '', '/?planq=coffee&day=all')
  render(<App />)
  await user.click(screen.getByRole('button', { name: 'View plan: Coffee after work' }))
  expect(await screen.findByRole('button', { name: 'Back to plans' })).toBeTruthy()
  expect(new URLSearchParams(location.search).get('p')).toBe(plan.id)
  expect(screen.queryByRole('button', { name: 'Explore plans', exact: true })).toBeNull()
  history.back()
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Back to plans' })).toBeNull())
  expect(new URLSearchParams(location.search).get('planq')).toBe('coffee')
  expect(screen.getByRole('button', { name: 'View plan: Coffee after work' })).toBeTruthy()
})
test('main view is restored from its URL after remount', async () => {
  navigate({ view: 'map' }, 'replace')
  const app = render(<App />)
  expect(await screen.findByText('Plan map content')).toBeTruthy()
  app.unmount()
  render(<App />)
  expect(await screen.findByText('Plan map content')).toBeTruthy()
})
test('a slow plan link cannot reopen its dialog after navigating away', async () => {
  let resolve!: (value: { data: Intent }) => void
  fetchPlan.mockReturnValue(
    new Promise((done) => {
      resolve = done
    }),
  )
  navigate({ p: plan.id }, 'replace')
  const user = userEvent.setup()
  render(<App />)
  await waitFor(() => expect(fetchPlan).toHaveBeenCalled())
  await user.click(screen.getByRole('button', { name: 'Plann’d home' }))
  await act(async () => resolve({ data: plan }))
  expect(screen.queryByRole('button', { name: 'Back to plans' })).toBeNull()
})
test('signed-out help exposes the approved contact without requiring authentication', () => {
  render(<HelpSheet onClose={vi.fn()} />)
  expect(
    screen.getByRole('link', { name: 'vipulsharma86481@gmail.com' }).getAttribute('href'),
  ).toContain('mailto:vipulsharma86481@gmail.com')
})
test('the chosen venue survives interrupted authentication and expires after thirty minutes', () => {
  rememberAuthIntent('post', {
    activity: 'coffee',
    venueName: 'Public café',
    googlePlaceId: place.id,
    lat: 26.9,
    lng: 75.8,
  })
  expect(readAuthIntent()?.venue?.googlePlaceId).toBe(place.id)
  const checkpoint = JSON.parse(sessionStorage.getItem('plannd:auth-intent')!)
  sessionStorage.setItem(
    'plannd:auth-intent',
    JSON.stringify({ ...checkpoint, at: Date.now() - 1800001 }),
  )
  expect(readAuthIntent()).toBeNull()
})
