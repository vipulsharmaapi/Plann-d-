// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import VenueMap from '../src/components/VenueMap'
import VenueDiscovery from '../src/components/VenueDiscovery'
import { loadGoogleMaps, onGoogleAuthFailure } from '../src/lib/googleMaps'
import { discoverVenues, type DiscoverableVenue } from '../src/lib/venues'

vi.mock('@googlemaps/markerclusterer', () => ({
  MarkerClusterer: class {
    constructor(options: ClusterOptions) {
      return new TestCluster(options)
    }
  },
  SuperClusterAlgorithm: class {},
}))

vi.mock('../src/lib/googleMaps', () => ({
  GOOGLE_MAP_ID: 'test',
  loadGoogleMaps: vi.fn(),
  onGoogleAuthFailure: vi.fn(),
}))
vi.mock('../src/lib/venues', async (original) => ({
  ...(await original<typeof import('../src/lib/venues')>()),
  discoverVenues: vi.fn(),
}))
const turf: DiscoverableVenue = {
  id: 'ChIJmapturf123',
  displayName: { text: 'Test turf' },
  location: { latitude: 26.9, longitude: 75.8 },
  rating: 4.5,
  formattedAddress: 'Mansarovar, Jaipur',
}
const cafe: DiscoverableVenue = {
  ...turf,
  id: 'ChIJmapcafe456',
  displayName: { text: 'Test café' },
  location: { latitude: 26.91, longitude: 75.79 },
}
let clusterers: TestCluster[]
let views: TestMap[], pins: TestMarker[], offAuth: ReturnType<typeof vi.fn>
class TestMap {
  fitBounds = vi.fn()
  setCenter = vi.fn()
  setZoom = vi.fn()
  panTo = vi.fn()
  getZoom = vi.fn(() => 12)
  addListener = vi.fn(() => ({ remove: vi.fn() }))
  constructor(public element: HTMLElement) {
    views.push(this)
  }
}
class TestBounds {
  points: unknown[] = []
  extend(point: unknown) {
    this.points.push(point)
  }
}
class TestMarker extends EventTarget {
  button = document.createElement('button')
  zIndex = 0
  private currentMap: TestMap | null = null
  position: unknown
  constructor(options: { map?: TestMap; content: HTMLElement; position: unknown; title?: string }) {
    super()
    this.position = options.position
    this.button.append(options.content)
    this.map = options.map ?? null
    if (options.title) this.title = options.title
    this.button.addEventListener('click', () => this.dispatchEvent(new Event('gmp-click')))
    pins.push(this)
  }
  set title(value: string) {
    this.button.setAttribute('aria-label', value)
  }
  set map(value: TestMap | null) {
    this.currentMap = value
    if (value) value.element.append(this.button)
    else this.button.remove()
  }
  get map() {
    return this.currentMap
  }
}
interface ClusterOptions {
  map: TestMap
  onClusterClick: (
    event: unknown,
    group: { markers: TestMarker[]; bounds: TestBounds },
    view: TestMap,
  ) => void
  renderer: { render: (group: { count: number; position: unknown }) => TestMarker }
}
class TestCluster {
  members: TestMarker[] = []
  constructor(public options: ClusterOptions) {
    clusterers.push(this)
  }
  clearMarkers() {
    this.members = []
  }
  addMarkers(markers: TestMarker[]) {
    this.members.push(...markers)
  }
  render() {
    for (const pin of this.members) pin.map = this.options.map
  }
  setMap(value: TestMap | null) {
    for (const pin of this.members) pin.map = value
  }
}
beforeEach(() => {
  clusterers = []
  views = []
  pins = []
  offAuth = vi.fn()
  vi.mocked(onGoogleAuthFailure).mockReturnValue(offAuth)
  vi.mocked(loadGoogleMaps).mockResolvedValue({
    maps: { Map: TestMap, LatLngBounds: TestBounds, marker: { AdvancedMarkerElement: TestMarker } },
  } as unknown as typeof google)
  Element.prototype.scrollIntoView = vi.fn()
})
afterEach(() => {
  cleanup()
  history.replaceState(null, '', '/')
  sessionStorage.clear()
  vi.resetAllMocks()
  vi.useRealTimers()
})

test('all venues have numbered selectable pins; selection keeps markers alive and posts the exact branch', async () => {
  const select = vi.fn(),
    post = vi.fn(),
    props = { places: [turf, cafe], selectedId: null, onSelect: select, onPost: post }
  const view = render(<VenueMap {...props} />)
  fireEvent.click(await screen.findByRole('button', { name: '2. Test café' }))
  expect(select).toHaveBeenCalledWith(cafe.id)
  expect(views[0].fitBounds.mock.calls[0][0].points).toEqual([
    { lat: 26.9, lng: 75.8 },
    { lat: 26.91, lng: 75.79 },
  ])
  view.rerender(<VenueMap {...props} selectedId={cafe.id} />)
  expect(pins).toHaveLength(2)
  expect(views[0].panTo).toHaveBeenLastCalledWith({ lat: 26.91, lng: 75.79 })
  expect(pins[1].button.firstElementChild?.getAttribute('data-selected')).toBe('true')
  fireEvent.click(screen.getByRole('button', { name: 'Make a plan at Test café from map' }))
  expect(post).toHaveBeenCalledWith(cafe)
  fireEvent.click(screen.getByRole('button', { name: 'Fit all venues' }))
  expect(select).toHaveBeenLastCalledWith(null)
  view.unmount()
  expect(pins.every((pin) => pin.map === null)).toBe(true)
  expect(offAuth).toHaveBeenCalledOnce()
})

test('a single result gets a useful zoom and sorting renumbers the same pins', async () => {
  const props = { selectedId: null, onSelect: vi.fn(), onPost: vi.fn() }
  const view = render(<VenueMap {...props} places={[turf]} />)
  await screen.findByRole('button', { name: '1. Test turf' })
  expect(views[0].setZoom).toHaveBeenLastCalledWith(15)
  view.rerender(<VenueMap {...props} places={[cafe, turf]} />)
  await screen.findByRole('button', { name: '2. Test turf' })
  expect(screen.getByRole('button', { name: '1. Test café' })).toBeTruthy()
  expect(pins).toHaveLength(2)
})

test('map failure is recoverable without discarding venue selection', async () => {
  vi.mocked(loadGoogleMaps).mockRejectedValueOnce(new Error('network'))
  render(<VenueMap places={[turf]} selectedId={turf.id} onSelect={vi.fn()} onPost={vi.fn()} />)
  expect((await screen.findByRole('alert')).textContent).toContain(
    'Choose List to browse every venue',
  )
  fireEvent.click(screen.getByRole('button', { name: 'Retry map' }))
  await screen.findByRole('button', { name: '1. Test turf' })
  expect(screen.queryByRole('alert')).toBeNull()
})

test('timeout and authentication errors leave the cards usable and do not accept a late map load', async () => {
  vi.useFakeTimers()
  let resolve!: (g: typeof google) => void
  vi.mocked(loadGoogleMaps).mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done
      }),
  )
  const view = render(
    <VenueMap places={[turf]} selectedId={null} onSelect={vi.fn()} onPost={vi.fn()} />,
  )
  await act(async () => {
    vi.advanceTimersByTime(12000)
  })
  expect(screen.getByRole('alert')).toBeTruthy()
  await act(async () => resolve({} as typeof google))
  expect(views).toHaveLength(0)
  view.unmount()
  vi.useRealTimers()
  render(<VenueMap places={[turf]} selectedId={null} onSelect={vi.fn()} onPost={vi.fn()} />)
  await screen.findByRole('button', { name: '1. Test turf' })
  act(() => vi.mocked(onGoogleAuthFailure).mock.calls.at(-1)![0]())
  expect(screen.getByRole('alert')).toBeTruthy()
})

test('pagination adds every unique venue to the map; card actions reopen it and retain the plan handoff', async () => {
  vi.mocked(discoverVenues)
    .mockResolvedValueOnce({ places: [turf], nextPageToken: 'next' })
    .mockResolvedValueOnce({ places: [turf, cafe] })
  const user = userEvent.setup(),
    post = vi.fn()
  render(<VenueDiscovery activity="football" onActivity={vi.fn()} onPost={post} />)
  await screen.findByRole('button', { name: 'Select Test turf in Mansarovar' })
  await user.click(screen.getByRole('button', { name: 'Map', exact: true }))
  await screen.findByRole('button', { name: '1. Test turf' })
  await user.click(screen.getByRole('button', { name: 'Show more venues' }))
  await screen.findByRole('button', { name: '2. Test café' })
  expect(pins).toHaveLength(2)
  expect(screen.getAllByRole('article')).toHaveLength(2)
  await user.click(screen.getByRole('button', { name: 'List', exact: true }))
  expect(pins.every((pin) => pin.map === null)).toBe(true)
  await user.click(screen.getByRole('button', { name: /Select Test café in/, exact: false }))
  await user.click(screen.getByRole('button', { name: 'Map', exact: true }))
  await screen.findByRole('button', { name: '2. Test café' })
  await user.click(screen.getByRole('button', { name: 'Make a plan at Test café from map' }))
  expect(post).toHaveBeenCalledWith({
    activity: 'football',
    venueName: 'Test café',
    venueArea: 'Mansarovar',
    googlePlaceId: cafe.id,
    lat: 26.91,
    lng: 75.79,
  })
})

test('a cluster gives explicit choices even when two venues share a location; choosing one preserves its identity', async () => {
  const select = vi.fn(),
    post = vi.fn(),
    coincident = { ...cafe, location: turf.location }
  const view = render(
    <VenueMap places={[turf, coincident]} selectedId={null} onSelect={select} onPost={post} />,
  )
  await screen.findByRole('button', { name: '1. Test turf' })
  const cluster = clusterers[0]
  const groupMarker = cluster.options.renderer.render({
    count: 2,
    position: { lat: 26.9, lng: 75.8 },
  })
  expect(groupMarker.button.getAttribute('aria-label')).toBe('2 venues. Zoom in and choose a venue')
  expect(groupMarker.button.textContent).toBe('2venues')
  act(() =>
    cluster.options.onClusterClick(
      {},
      { markers: pins.slice(0, 2), bounds: new TestBounds() },
      views[0],
    ),
  )
  expect(screen.getByRole('heading', { name: 'Choose from 2 nearby venues' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Select Test café on map' }))
  expect(select).toHaveBeenLastCalledWith(cafe.id)
  view.rerender(
    <VenueMap places={[turf, coincident]} selectedId={cafe.id} onSelect={select} onPost={post} />,
  )
  expect(cluster.members).toEqual([pins[0], pins[1]])
  expect(views[0].setZoom).toHaveBeenLastCalledWith(16)
  expect(pins[1].map).toBe(views[0])
  expect(pins[1].zIndex).toBe(10000)
  fireEvent.click(screen.getByRole('button', { name: 'Make a plan at Test café from map' }))
  expect(post).toHaveBeenCalledWith(coincident)
})
