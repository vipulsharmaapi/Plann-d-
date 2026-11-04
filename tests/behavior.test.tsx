// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Explore from '../src/components/Explore'
import { createCalendar, foldCalendarLine } from '../src/lib/calendar'
import { mergeMessages, type Message } from '../src/lib/messages'
import type { Intent } from '../src/types'
const plan: Intent = {
  id: '20000000-0000-4000-8000-000000000001',
  activity: 'coffee',
  title: 'Coffee, conversation; and a walk',
  lat: 26.9,
  lng: 75.8,
  venueName: 'Public café',
  date: '2026-11-04',
  startsAt: '23:30',
  endsAt: '01:00',
  startsAtIso: '2026-11-04T18:00:00Z',
  endsAtIso: '2026-11-04T19:30:00Z',
  spotsFilled: 0,
  spotsNeeded: 2,
  posterName: 'Host',
  posterJoinCount: 0,
  womenOnly: false,
}
afterEach(cleanup)
describe('discovery states', () => {
  const props = {
    intents: [],
    onOpen: vi.fn(),
    onPost: vi.fn(),
    onRetry: vi.fn(),
    userLoc: null,
    onRequestLocation: vi.fn(),
    activity: null,
    onActivity: vi.fn(),
  }
  test('loading and network failures never masquerade as an empty live market', () => {
    const { rerender } = render(<Explore {...props} source="loading" />)
    expect(screen.getByRole('status').textContent).toContain('Loading')
    expect(screen.queryByText('Your next plan can start here')).toBeNull()
    rerender(<Explore {...props} source="error" />)
    expect(screen.getByRole('alert').textContent).toContain('couldn’t refresh')
    expect(screen.queryByText('Your next plan can start here')).toBeNull()
    expect(screen.queryByText(/live plans/)).toBeNull()
  })
  test('empty discovery offers posting and unmatched search can be cleared', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<Explore {...props} source="live" />)
    await user.click(screen.getByRole('button', { name: 'Post the first plan' }))
    expect(props.onPost).toHaveBeenCalledOnce()
    rerender(<Explore {...props} intents={[plan]} source="live" />)
    await user.type(screen.getByRole('searchbox'), 'missing venue')
    expect(screen.getByText('No plans match yet')).toBeTruthy()
    await user.click(screen.getAllByRole('button', { name: 'Clear filters' })[0])
    expect(screen.getByText(plan.title)).toBeTruthy()
  })
})
test('calendar preserves real cross-midnight timestamps, escapes values, folds Unicode and adds an alert', () => {
  const ics = createCalendar(plan, 'https://example.com', new Date('2026-11-01T00:00:00Z'))
  expect(ics).toContain('DTSTART:20261104T180000Z\r\nDTEND:20261104T193000Z')
  expect(ics).toContain('SUMMARY:Coffee\\, conversation\\; and a walk')
  expect(ics).toContain('TRIGGER:-PT30M')
  const folded = foldCalendarLine('DESCRIPTION:' + '🏸'.repeat(50))
  expect(folded.split('\r\n').every((line) => new TextEncoder().encode(line).length <= 75)).toBe(
    true,
  )
  expect(folded.replace(/\r\n /g, '')).toBe('DESCRIPTION:' + '🏸'.repeat(50))
})
test('latest-page loading and realtime delivery merge without losing or duplicating messages', () => {
  const a: Message = {
      id: 'a',
      user_id: 'u',
      body: 'A',
      created_at: '2026-11-04T10:00:00Z',
      reply_to: null,
    },
    b = { ...a, id: 'b', body: 'B' },
    c = { ...a, id: 'c', body: 'C', created_at: '2026-11-04T11:00:00Z' }
  expect(mergeMessages([c], [b, a, c]).map((m) => m.id)).toEqual(['a', 'b', 'c'])
})
