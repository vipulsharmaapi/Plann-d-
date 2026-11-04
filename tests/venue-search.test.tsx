// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import VenueSearch from '../src/components/VenueSearch'
import Explore from '../src/components/Explore'
import { discoverVenues, type DiscoverableVenue } from '../src/lib/venues'

vi.mock('../src/components/VenueMap', () => ({ default: () => null }))

vi.mock('../src/lib/venues', async (original) => ({
  ...(await original<typeof import('../src/lib/venues')>()),
  discoverVenues: vi.fn(),
}))
const search = vi.mocked(discoverVenues)
const cafe: DiscoverableVenue = {
  id: 'ChIJsearchcafe123',
  displayName: { text: 'Roastery Café' },
  location: { latitude: 26.9, longitude: 75.8 },
  primaryType: 'cafe',
  formattedAddress: 'Vaishali Nagar, Jaipur',
  rating: 4.2,
}
afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})

test('Explore exposes a separate search action without triggering a category lookup', async () => {
  const user = userEvent.setup()
  render(
    <Explore
      intents={[]}
      source="live"
      onOpen={vi.fn()}
      onPost={vi.fn()}
      onRetry={vi.fn()}
      userLoc={null}
      onRequestLocation={vi.fn()}
      activity={null}
      onActivity={vi.fn()}
      onVenuePost={vi.fn()}
    />,
  )
  await user.click(screen.getByRole('button', { name: 'Search venues' }))
  await screen.findByRole('search', { name: 'Search Jaipur venues' })
  expect(search).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Search venues' }).getAttribute('aria-pressed')).toBe(
    'true',
  )
})

test('only submission searches; area and keywords survive pagination and the chosen branch becomes a café plan', async () => {
  search.mockResolvedValueOnce({ places: [cafe], nextPageToken: 'page2' }).mockResolvedValueOnce({
    places: [
      cafe,
      { ...cafe, id: 'ChIJsearchcafe456', displayName: { text: 'Second café' }, rating: 5 },
    ],
  })
  const user = userEvent.setup(),
    post = vi.fn()
  render(<VenueSearch onPost={post} />)
  await user.type(screen.getByLabelText('Venue or activity'), '  Roastery  ')
  await user.type(screen.getByLabelText('Area in Jaipur (optional)'), 'Vaishali  Nagar')
  expect(search).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: 'Search', exact: true }))
  await screen.findByRole('button', { name: 'Make a plan at Roastery Café' })
  expect(search.mock.calls[0][0]).toEqual({ query: 'Roastery', area: 'Vaishali Nagar' })
  expect((screen.getByLabelText('Sort places') as HTMLSelectElement).value).toBe('relevance')
  expect([...document.querySelectorAll('mark')].map((mark) => mark.textContent)).toEqual([
    'Roastery',
    'Vaishali',
    'Nagar',
  ])
  await user.clear(screen.getByLabelText('Venue or activity'))
  await user.type(screen.getByLabelText('Venue or activity'), 'football')
  await user.click(screen.getByRole('button', { name: 'Show more places' }))
  await screen.findByRole('button', { name: 'Make a plan at Second café' })
  expect(search.mock.calls[1][0]).toEqual({ query: 'Roastery', area: 'Vaishali Nagar' })
  expect(search.mock.calls[1][2]).toBe('page2')
  expect(screen.getAllByRole('article')).toHaveLength(2)
  expect(screen.getAllByRole('article')[0].querySelector('h3')?.textContent).toBe(
    '1. Roastery Café',
  )
  await user.click(screen.getByRole('button', { name: 'Make a plan at Roastery Café' }))
  expect(post).toHaveBeenCalledWith({
    activity: 'coffee',
    venueName: 'Roastery Café',
    googlePlaceId: cafe.id,
    lat: 26.9,
    lng: 75.8,
  })
})

test('a new submitted search aborts and ignores an old response', async () => {
  let finish!: (result: { places: DiscoverableVenue[] }) => void
  search
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    .mockResolvedValueOnce({ places: [cafe] })
  const user = userEvent.setup()
  render(<VenueSearch onPost={vi.fn()} />)
  await user.click(screen.getByRole('button', { name: 'Football · Mansarovar' }))
  const oldSignal = search.mock.calls[0][1]
  await user.click(screen.getByRole('button', { name: 'Roastery', exact: true }))
  await screen.findByRole('button', { name: 'Make a plan at Roastery Café' })
  await act(async () =>
    finish({ places: [{ ...cafe, displayName: { text: 'Stale football turf' } }] }),
  )
  expect(oldSignal.aborted).toBe(true)
  expect(screen.queryByText('Stale football turf')).toBeNull()
  expect(screen.getByRole('heading', { name: 'Results for “Roastery”' })).toBeTruthy()
})
