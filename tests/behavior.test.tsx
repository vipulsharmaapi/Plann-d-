// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Explore from '../src/components/Explore'
import ConfirmAction from '../src/components/ConfirmAction'
import Sheet from '../src/components/Sheet'
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
// jsdom has no modal implementation. Browser focus/Escape are checked separately.
HTMLDialogElement.prototype.showModal = function () {
  this.open = true
}
HTMLDialogElement.prototype.close = function () {
  this.open = false
}
afterEach(cleanup)
test('cancelling a nested confirmation does not dismiss its parent plan', () => {
  const parentClose = vi.fn(),
    childClose = vi.fn()
  render(
    <Sheet title="Plan details" onClose={parentClose}>
      <Sheet title="Leave this plan?" onClose={childClose}>
        Confirm membership change
      </Sheet>
    </Sheet>,
  )
  fireEvent(
    screen.getByRole('dialog', { name: 'Leave this plan?' }),
    new Event('cancel', { cancelable: true }),
  )
  expect(childClose).toHaveBeenCalledOnce()
  expect(parentClose).not.toHaveBeenCalled()
})
test('a destructive action is not run on open or dismissal, only explicit confirmation', async () => {
  const user = userEvent.setup()
  const action = vi.fn(),
    close = vi.fn()
  const confirmation = {
    title: 'Leave this plan?',
    description: 'Your spot will be released.',
    label: 'Leave plan',
    action,
  }
  render(<ConfirmAction confirmation={confirmation} onClose={close} />)
  expect(screen.getByRole('dialog', { name: 'Leave this plan?' })).toBeTruthy()
  expect(action).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: 'Go back' }))
  expect(close).toHaveBeenCalledOnce()
  expect(action).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: 'Leave plan', exact: true }))
  expect(action).toHaveBeenCalledOnce()
})
describe('discovery states', () => {
  const props = {
    intents: [],
    onOpen: vi.fn(),
    onPost: vi.fn(),
    onVenuePost: vi.fn(),
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
