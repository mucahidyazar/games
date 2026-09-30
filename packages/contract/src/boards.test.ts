import { describe, expect, it } from 'vitest'
import { BOARDS, boardById, boardKey, isoWeekKey, periodsFor, utcDateKey } from './boards'

describe('date keys', () => {
  it('formats UTC dates and ISO weeks', () => {
    expect(utcDateKey(new Date('2026-09-24T23:30:00Z'))).toBe('2026-09-24')
    expect(isoWeekKey(new Date('2026-09-24T12:00:00Z'))).toBe('2026-W39')
    // ISO weeks belong to the year of their Thursday.
    expect(isoWeekKey(new Date('2027-01-01T12:00:00Z'))).toBe('2026-W53')
    expect(isoWeekKey(new Date('2025-12-29T12:00:00Z'))).toBe('2026-W01')
  })
})

describe('boards', () => {
  it('has a score board for every ranked mode and the record boards', () => {
    expect(BOARDS.map((board) => board.id)).toEqual([
      'score.classic',
      'score.daily',
      'score.timeAttack',
      'score.limitedWalls',
      'score.hardcore',
      'stat.tightestTrap',
      'stat.biggestCapture',
      'stat.flawlessStreak',
      'stat.badges',
    ])
  })

  it('knows which periods each board supports', () => {
    expect(periodsFor(boardById('score.classic'))).toEqual(['week', 'all'])
    expect(periodsFor(boardById('score.daily'))).toEqual(['day'])
    expect(periodsFor(boardById('stat.tightestTrap'))).toEqual(['all'])
  })

  it('builds storage keys for a board, period and moment', () => {
    const at = new Date('2026-09-24T08:00:00Z')

    expect(boardKey('score.classic', 'all', at)).toBe('score.classic:all')
    expect(boardKey('score.classic', 'week', at)).toBe('score.classic:week:2026-W39')
    expect(boardKey('score.daily', 'day', at)).toBe('score.daily:day:2026-09-24')
  })

  it('refuses a period the board does not have', () => {
    expect(() => boardKey('stat.badges', 'week', new Date())).toThrow(RangeError)
  })
})
