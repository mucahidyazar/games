import { evaluateRunBadges, type RunStats } from '@games/trap-the-orb-engine'
import { describe, expect, it } from 'vitest'
import { badgesForRun } from './badges'

const STATS: RunStats = {
  levelsCleared: 5,
  highestLevel: 6,
  wallsBuilt: 40,
  wallsBroken: 0,
  tightestTrapPct: 2.5,
  biggestCapturePct: 45,
  bestClearPct: 91,
  perfectStreak: 5,
  bestPerfectStreak: 5,
  fastestClearRatio: 0.9,
  maxRegionsInOneWall: 1,
  fewestWallsClear: null,
}

describe('badgesForRun', () => {
  it("returns the engine's run badges for regular modes, ignoring the daily streak", () => {
    expect(badgesForRun(STATS, 'classic', 30)).toEqual(evaluateRunBadges(STATS, 'classic'))
  })

  it('adds Devotee to Daily Challenge runs once the streak reaches a tier', () => {
    expect(badgesForRun(STATS, 'daily', 2).some((badge) => badge.id === 'devotee')).toBe(false)
    expect(badgesForRun(STATS, 'daily', 3)).toContainEqual({ id: 'devotee', tier: 1 })
    expect(badgesForRun(STATS, 'daily', 7)).toContainEqual({ id: 'devotee', tier: 2 })
    expect(badgesForRun(STATS, 'daily', 30)).toContainEqual({ id: 'devotee', tier: 3 })
  })
})
