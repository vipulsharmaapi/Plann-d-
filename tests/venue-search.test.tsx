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
  history.replaceState(null, '', '/')
  sessionStorage.clear()
  vi.resetAllMocks()
})

test('Explore makes plans primary and venue discovery stays public', async () => {
  search.mockResolvedValue({ places: [] })
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
  expect(search).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: 'Explore venues' }))
  await screen.findByRole('search', { name: 'Search Jaipur venues' })
  expect(new URLSearchParams(location.search).get('browse')).toBe('search')
  expect(screen.getByRole('button', { name: 'Back to plans' })).toBeTruthy()
})

test('editing waits for submission; pagination retains submitted query and the exact branch handoff', async () => {
  search
    .mockResolvedValueOnce({ places: [] })
    .mockResolvedValueOnce({ places: [cafe], nextPageToken: 'page2' })
    .mockResolvedValueOnce({
      places: [cafe, { ...cafe, id: 'ChIJsecondcafe456', displayName: { text: 'Second café' } }],
    })
  const user = userEvent.setup(),
    post = vi.fn()
  render(<VenueSearch onPost={post} />)
  await screen.findByText('No matching venues found')
  await user.type(screen.getByLabelText('Venue or activity'), '  Roastery  ')
  await user.selectOptions(screen.getByLabelText('Neighbourhood'), 'Vaishali Nagar')
  expect(search).toHaveBeenCalledTimes(1)
  await user.click(screen.getByRole('button', { name: 'Search venues' }))
  await screen.findByRole('button', { name: 'Select Roastery Café in Vaishali Nagar' })
  expect(search.mock.calls[1][0]).toEqual({ query: 'Roastery', area: 'Vaishali Nagar' })
  await user.clear(screen.getByLabelText('Venue or activity'))
  await user.type(screen.getByLabelText('Venue or activity'), 'football')
  await user.click(screen.getByRole('button', { name: 'Show more venues' }))
  await screen.findByRole('button', { name: 'Select Second café in Vaishali Nagar' })
  expect(search.mock.calls[2][0]).toEqual({ query: 'Roastery', area: 'Vaishali Nagar' })
  expect(search.mock.calls[2][2]).toBe('page2')
  expect(
    screen.getAllByRole('button', { name: 'Select Roastery Café in Vaishali Nagar' }),
  ).toHaveLength(1)
  await user.click(screen.getByRole('button', { name: 'Make a plan here' }))
  expect(post).toHaveBeenCalledWith({
    activity: 'coffee',
    venueName: 'Roastery Café',
    venueArea: 'Vaishali Nagar',
    googlePlaceId: cafe.id,
    lat: 26.9,
    lng: 75.8,
  })
})

test('Enter submits a new query and late old responses are ignored', async () => {
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
  const oldSignal = search.mock.calls[0][1]
  await user.type(screen.getByLabelText('Venue or activity'), 'Roastery{Enter}')
  await screen.findByRole('button', { name: 'Select Roastery Café in Vaishali Nagar' })
  await act(async () =>
    finish({ places: [{ ...cafe, displayName: { text: 'Stale football turf' } }] }),
  )
  expect(oldSignal.aborted).toBe(true)
  expect(screen.queryByText('Stale football turf')).toBeNull()
  expect(new URLSearchParams(location.search).get('q')).toBe('Roastery')
})
