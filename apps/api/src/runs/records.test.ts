import type { RunStats } from '@games/trap-the-orb-engine'
import { describe, expect, it } from 'vitest'
import { recordCandidates, type RecordSource } from './records'

const STATS: RunStats = {
  levelsCleared: 2,
  highestLevel: 3,
  wallsBuilt: 20,
  wallsBroken: 1,
  tightestTrapPct: 1.25,
  biggestCapturePct: 31.5,
  bestClearPct: 82,
  perfectStreak: 1,
  bestPerfectStreak: 2,
  fastestClearRatio: 0.7,
  maxRegionsInOneWall: 2,
  fewestWallsClear: 5,
}

const source = (overrides: Partial<RecordSource> = {}): RecordSource => ({
  mode: 'classic',
  score: 1234,
  level: 3,
  stats: STATS,
  badgeTotal: 4,
  finishedAt: new Date('2026-09-24T12:00:00Z'),
  dailyDate: null,
  ...overrides,
})

describe('recordCandidates', () => {
  it("puts a Classic run on its weekly and all-time score tables and on every record board", () => {
    expect(recordCandidates(source())).toEqual([
      { board: 'score.classic', period: 'week', key: 'score.classic:week:2026-W39', direction: 'desc', value: 1234, level: 3 },
      { board: 'score.classic', period: 'all', key: 'score.classic:all', direction: 'desc', value: 1234, level: 3 },
      { board: 'stat.tightestTrap', period: 'all', key: 'stat.tightestTrap:all', direction: 'asc', value: 1.25, level: null },
      { board: 'stat.biggestCapture', period: 'all', key: 'stat.biggestCapture:all', direction: 'desc', value: 31.5, level: null },
      { board: 'stat.flawlessStreak', period: 'all', key: 'stat.flawlessStreak:all', direction: 'desc', value: 2, level: null },
      { board: 'stat.badges', period: 'all', key: 'stat.badges:all', direction: 'desc', value: 4, level: null },
    ])
  })

  it("files Daily Challenge scores under the challenge's day, not the finishing moment", () => {
    const keys = recordCandidates(source({ mode: 'daily', dailyDate: '2026-09-23' })).map((candidate) => candidate.key)
    expect(keys[0]).toBe('score.daily:day:2026-09-23')
    expect(keys).not.toContain('score.classic:all')
  })

  it('skips record boards the run achieved nothing on', () => {
    const empty: RunStats = { ...STATS, tightestTrapPct: null, biggestCapturePct: 0, bestPerfectStreak: 0 }
    const boards = recordCandidates(source({ stats: empty, badgeTotal: 0, mode: 'hardcore' })).map((candidate) => candidate.board)
    expect(boards).toEqual(['score.hardcore', 'score.hardcore'])
  })
})
