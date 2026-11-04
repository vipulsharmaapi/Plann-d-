// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import VenueDiscovery from '../src/components/VenueDiscovery'
import { discoverVenues, type DiscoverableVenue } from '../src/lib/venues'

vi.mock('../src/components/VenueMap', () => ({ default: () => null }))

vi.mock('../src/lib/venues', async (original) => ({
  ...(await original<typeof import('../src/lib/venues')>()),
  discoverVenues: vi.fn(),
}))
const search = vi.mocked(discoverVenues)
const turf: DiscoverableVenue = {
  id: 'ChIJtestturf123',
  displayName: { text: 'Test football turf' },
  location: { latitude: 26.9, longitude: 75.8 },
  rating: 4.8,
  userRatingCount: 40,
}
const cafe: DiscoverableVenue = {
  ...turf,
  id: 'ChIJtestcafe456',
  displayName: { text: 'Test café' },
}
afterEach(() => {
  cleanup()
  history.replaceState(null, '', '/')
  sessionStorage.clear()
  vi.resetAllMocks()
})

test('choosing a venue hands off the matching activity, branch and coordinates without publishing', async () => {
  search.mockResolvedValue({ places: [turf] })
  const post = vi.fn(),
    user = userEvent.setup()
  render(<VenueDiscovery activity="football" onActivity={vi.fn()} onPost={post} />)
  expect(post).not.toHaveBeenCalled()
  await user.click(await screen.findByRole('button', { name: 'Make a plan at Test football turf' }))
  expect(post).toHaveBeenCalledWith({
    activity: 'football',
    venueName: turf.displayName.text,
    googlePlaceId: turf.id,
    lat: 26.9,
    lng: 75.8,
  })
})

test('switching categories aborts the old request and ignores its late response', async () => {
  let finishFootball!: (value: { places: DiscoverableVenue[] }) => void
  search
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishFootball = resolve
        }),
    )
    .mockResolvedValueOnce({ places: [cafe] })
  const props = { onActivity: vi.fn(), onPost: vi.fn() }
  const view = render(<VenueDiscovery {...props} activity="football" />)
  const footballSignal = search.mock.calls[0][1]
  view.rerender(<VenueDiscovery {...props} activity="coffee" />)
  await screen.findByText('Test café')
  await act(async () => finishFootball({ places: [turf] }))
  expect(footballSignal.aborted).toBe(true)
  expect(screen.queryByText('Test football turf')).toBeNull()
})

test('search failures stay distinct from empty results and can be retried', async () => {
  search.mockRejectedValueOnce(new Error('quota')).mockResolvedValueOnce({ places: [] })
  const user = userEvent.setup()
  render(<VenueDiscovery activity="football" onActivity={vi.fn()} onPost={vi.fn()} />)
  expect((await screen.findByRole('alert')).textContent).toContain('Places couldn’t load')
  expect(screen.queryByText('No matching venues found')).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Try again' }))
  await screen.findByText('No matching venues found')
  expect(screen.queryByRole('alert')).toBeNull()
})

test('pagination retries keep existing venues and never duplicate a returned branch', async () => {
  search
    .mockResolvedValueOnce({ places: [turf], nextPageToken: 'next' })
    .mockRejectedValueOnce(new Error('network'))
    .mockResolvedValueOnce({ places: [turf, cafe] })
  const user = userEvent.setup()
  render(<VenueDiscovery activity="football" onActivity={vi.fn()} onPost={vi.fn()} />)
  await user.click(await screen.findByRole('button', { name: 'Show more places' }))
  await screen.findByRole('alert')
  expect(screen.getByText('Test football turf')).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Try again' }))
  await screen.findByText('Test café')
  expect(screen.getAllByText('Test football turf')).toHaveLength(1)
  expect(search.mock.calls[2][2]).toBe('next')
  await waitFor(() =>
    expect(screen.getByRole('status', { name: 'Venue results' }).textContent).toBe(
      '2 places found',
    ),
  )
})
