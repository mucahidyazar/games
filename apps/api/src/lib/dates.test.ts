import { describe, expect, it } from 'vitest'
import { addDays, parseIsoDate } from './dates'

describe('parseIsoDate', () => {
  it('parses calendar days as UTC midnight', () => {
    expect(parseIsoDate('2026-09-24')?.toISOString()).toBe('2026-09-24T00:00:00.000Z')
    expect(parseIsoDate('2028-02-29')?.toISOString()).toBe('2028-02-29T00:00:00.000Z')
  })

  it('rejects malformed and impossible dates instead of rolling them over', () => {
    for (const value of ['2026-02-31', '2026-13-01', '2027-02-29', '24-09-2026', '2026-9-24', '']) {
      expect(parseIsoDate(value), value).toBeNull()
    }
  })
})

describe('addDays', () => {
  it('moves across months and years', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('refuses a malformed day', () => {
    expect(() => addDays('yesterday', 1)).toThrow(RangeError)
  })
})
