// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { useSavedPlans } from '../src/hooks/useSavedPlans'
const mock = vi.hoisted(() => ({
  rows: [] as { intent_id: string }[],
  fail: false,
  write: vi.fn(),
}))
vi.mock('../src/lib/supabase', () => ({
  supabase: {
    from: () => {
      let mode = 'read',
        value: any
      const q = {
        select: () => q,
        eq: () => q,
        order: () => q,
        insert: (v: any) => {
          mode = 'insert'
          value = v
          return q
        },
        delete: () => {
          mode = 'delete'
          return q
        },
        then: (resolve: any) =>
          Promise.resolve()
            .then(async () => {
              if (mode === 'read') return { data: mock.rows, error: null }
              await mock.write()
              if (mock.fail) return { error: { message: 'offline' } }
              mock.rows = mode === 'insert' ? [{ intent_id: value.intent_id }] : []
              return { error: null }
            })
            .then(resolve),
      }
      return q
    },
  },
}))
afterEach(() => {
  cleanup()
  mock.rows = []
  mock.fail = false
  mock.write.mockReset()
})
test('saved plans persist after remount and disappear when switching to signed out', async () => {
  const first = renderHook(() => useSavedPlans('alice'))
  await waitFor(() => expect(first.result.current.loading).toBe(false))
  await act(() => first.result.current.toggle('plan'))
  expect(first.result.current.ids).toEqual(['plan'])
  first.unmount()
  const second = renderHook(({ id }) => useSavedPlans(id), {
    initialProps: { id: 'alice' as string | undefined },
  })
  await waitFor(() => expect(second.result.current.ids).toEqual(['plan']))
  second.rerender({ id: undefined })
  await waitFor(() => expect(second.result.current.ids).toEqual([]))
})
test('failed saves remain unsaved, and a refresh allows a safe retry', async () => {
  const { result } = renderHook(() => useSavedPlans('alice'))
  await waitFor(() => expect(result.current.loading).toBe(false))
  mock.fail = true
  await act(() => result.current.toggle('plan'))
  expect(result.current.ids).toEqual([])
  expect(result.current.error).toContain('Couldn’t update')
  mock.fail = false
  await act(() => result.current.refresh())
  await act(() => result.current.toggle('plan'))
  expect(result.current.ids).toEqual(['plan'])
})
test('a focus event during a pending save cannot discard the successful save', async () => {
  let finish!: () => void
  mock.write.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve
      }),
  )
  const { result } = renderHook(() => useSavedPlans('alice'))
  await waitFor(() => expect(result.current.loading).toBe(false))
  let saving!: Promise<void>
  act(() => {
    saving = result.current.toggle('plan')
  })
  await waitFor(() => expect(result.current.busy).toBe(true))
  act(() => window.dispatchEvent(new Event('focus')))
  await act(async () => {
    finish()
    await saving
  })
  expect(result.current.ids).toEqual(['plan'])
})
