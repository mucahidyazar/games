import { describe, expect, it } from 'vitest'
import { resolveBoardKey } from './query'

const NOW = new Date('2026-09-24T18:30:00Z')

describe('resolveBoardKey', () => {
  it('defaults day and week tables to now (UTC)', () => {
    expect(resolveBoardKey({ board: 'score.daily', period: 'day' }, NOW)).toBe('score.daily:day:2026-09-24')
    expect(resolveBoardKey({ board: 'score.classic', period: 'week' }, NOW)).toBe('score.classic:week:2026-W39')
    expect(resolveBoardKey({ board: 'stat.badges', period: 'all' }, NOW)).toBe('stat.badges:all')
  })

  it('uses the requested date for day and week tables', () => {
    expect(resolveBoardKey({ board: 'score.daily', period: 'day', date: '2026-09-01' }, NOW)).toBe('score.daily:day:2026-09-01')
    expect(resolveBoardKey({ board: 'score.timeAttack', period: 'week', date: '2027-01-01' }, NOW)).toBe('score.timeAttack:week:2026-W53')
  })

  it('returns null for impossible dates and periods a board does not have', () => {
    expect(resolveBoardKey({ board: 'score.daily', period: 'day', date: '2026-02-30' }, NOW)).toBeNull()
    expect(resolveBoardKey({ board: 'stat.tightestTrap', period: 'week' }, NOW)).toBeNull()
    expect(resolveBoardKey({ board: 'score.classic', period: 'day' }, NOW)).toBeNull()
  })
})
