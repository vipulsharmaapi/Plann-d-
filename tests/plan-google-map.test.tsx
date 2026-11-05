// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import JaipurMap from '../src/components/JaipurMap'
import { loadGoogleMaps, onGoogleAuthFailure } from '../src/lib/googleMaps'
import type { Intent } from '../src/types'
vi.mock('../src/lib/googleMaps', () => ({
  GOOGLE_MAP_ID: 'existing-map-id',
  loadGoogleMaps: vi.fn(),
  onGoogleAuthFailure: vi.fn(),
}))
let views: TestMap[], pins: TestMarker[]
class TestMap {
  fitBounds = vi.fn()
  setCenter = vi.fn()
  setZoom = vi.fn()
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
  position: unknown
  private currentMap: TestMap | null = null
  constructor(options: { map: TestMap; content: HTMLElement }) {
    super()
    this.button.append(options.content)
    this.map = options.map
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
const plan = {
  id: 'coffee',
  title: 'Coffee after work',
  activity: 'coffee',
  venueName: 'Public café',
  lat: 26.91,
  lng: 75.74,
  date: '2099-11-05',
  startsAt: '17:00',
  endsAt: '19:00',
  spotsNeeded: 3,
  spotsFilled: 1,
} as Intent
const other = { ...plan, id: 'sport', title: 'Badminton doubles', lat: 26.85, lng: 75.8 }
beforeEach(() => {
  views = []
  pins = []
  vi.mocked(onGoogleAuthFailure).mockReturnValue(vi.fn())
  vi.mocked(loadGoogleMaps).mockResolvedValue({
    maps: { Map: TestMap, LatLngBounds: TestBounds, marker: { AdvancedMarkerElement: TestMarker } },
  } as unknown as typeof google)
})
afterEach(() => {
  cleanup()
  vi.resetAllMocks()
  vi.useRealTimers()
})
test('Google pins show all real coordinates, keep identity on selection, and open the selected plan', async () => {
  const select = vi.fn(),
    details = vi.fn(),
    props = { plans: [plan, other], onSelect: select, onDetails: details }
  const view = render(<JaipurMap {...props} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Coffee after work at Public café' }))
  expect(select).toHaveBeenCalledWith(plan)
  expect(views[0].fitBounds.mock.calls[0][0].points).toEqual([
    { lat: 26.91, lng: 75.74 },
    { lat: 26.85, lng: 75.8 },
  ])
  view.rerender(<JaipurMap {...props} selected={plan} />)
  expect(pins).toHaveLength(2)
  expect(pins[0].zIndex).toBe(1000)
  fireEvent.click(screen.getByRole('button', { name: /Coffee after work.*2 spots open/ }))
  expect(details).toHaveBeenCalledWith(plan)
  view.rerender(<JaipurMap {...props} plans={[other]} />)
  expect(pins[0].map).toBeNull()
  expect(views[0].setZoom).toHaveBeenLastCalledWith(14)
  view.unmount()
  expect(pins.every((p) => p.map === null)).toBe(true)
})
test('failed Google loading offers retry without switching providers', async () => {
  vi.mocked(loadGoogleMaps).mockRejectedValueOnce(new Error('network'))
  render(<JaipurMap plans={[plan]} onSelect={vi.fn()} onDetails={vi.fn()} />)
  expect((await screen.findByRole('alert')).textContent).toContain('Google Maps couldn’t load')
  fireEvent.click(screen.getByRole('button', { name: 'Retry map' }))
  await screen.findByRole('button', { name: 'Coffee after work at Public café' })
  expect(screen.queryByRole('alert')).toBeNull()
  act(() => vi.mocked(onGoogleAuthFailure).mock.calls.at(-1)![0]())
  expect(screen.getByRole('alert')).toBeTruthy()
})
test('a timed-out Google load cannot attach a late map', async () => {
  vi.useFakeTimers()
  let resolve!: (g: typeof google) => void
  vi.mocked(loadGoogleMaps).mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done
      }),
  )
  render(<JaipurMap plans={[plan]} onSelect={vi.fn()} onDetails={vi.fn()} />)
  await act(async () => {
    vi.advanceTimersByTime(12000)
  })
  expect(screen.getByRole('alert')).toBeTruthy()
  await act(async () => resolve({} as typeof google))
  expect(views).toHaveLength(0)
})
