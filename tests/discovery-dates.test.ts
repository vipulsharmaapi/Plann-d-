import { expect, test } from 'vitest'
import { matchesDay } from '../src/lib/discovery'
test('date filters follow the current IST date, including Sunday and year boundaries', () => {
  expect(matchesDay('2027-01-01', 'tomorrow', '2026-12-31')).toBe(true)
  expect(matchesDay('2026-11-07', 'weekend', '2026-11-05')).toBe(true)
  expect(matchesDay('2026-11-08', 'weekend', '2026-11-05')).toBe(true)
  expect(matchesDay('2026-11-09', 'weekend', '2026-11-05')).toBe(false)
  expect(matchesDay('2026-11-08', 'weekend', '2026-11-08')).toBe(true)
  expect(matchesDay('2026-11-09', 'weekend', '2026-11-08')).toBe(false)
  expect(matchesDay('2026-11-14', 'weekend', '2026-11-09')).toBe(true)
})
