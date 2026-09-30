import { describe, expect, it } from 'vitest'
import { dailyStreak } from './streak'

describe('dailyStreak', () => {
  it('counts consecutive days ending today', () => {
    expect(dailyStreak(['2026-09-24', '2026-09-23', '2026-09-22', '2026-09-20'], '2026-09-24')).toBe(3)
  })

  it("still counts a streak that ended yesterday, since today's challenge may be pending", () => {
    expect(dailyStreak(['2026-09-23', '2026-09-22'], '2026-09-24')).toBe(2)
  })

  it('is zero once a day was missed', () => {
    expect(dailyStreak(['2026-09-22', '2026-09-21'], '2026-09-24')).toBe(0)
    expect(dailyStreak([], '2026-09-24')).toBe(0)
  })

  it('crosses month and year boundaries', () => {
    expect(dailyStreak(['2027-01-01', '2026-12-31', '2026-12-30'], '2027-01-01')).toBe(3)
    expect(dailyStreak(['2028-03-01', '2028-02-29'], '2028-03-01')).toBe(2)
  })
})
