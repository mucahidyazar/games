import { describe, expect, it } from 'vitest'
import {
  EMPTY_STATS,
  statsAfterCapture,
  statsAfterLevelClear,
  statsAfterLevelStart,
  statsAfterWallsBroken,
  statsAfterWallStarted,
} from './stats'

const clear = (overrides: Partial<Parameters<typeof statsAfterLevelClear>[1]> = {}) => ({
  percent: 80,
  elapsedMs: 30_000,
  parSeconds: 40,
  livesLost: 0,
  wallsUsed: 5,
  orbCount: 3,
  ...overrides,
})

describe('run stats', () => {
  it('starts empty on level 1', () => {
    expect(EMPTY_STATS).toMatchObject({ levelsCleared: 0, highestLevel: 1, tightestTrapPct: null })
  })

  it('tracks the highest level reached', () => {
    const stats = statsAfterLevelStart(statsAfterLevelStart(EMPTY_STATS, 4), 2)

    expect(stats.highestLevel).toBe(4)
  })

  it('counts walls built and broken', () => {
    const stats = statsAfterWallsBroken(statsAfterWallStarted(statsAfterWallStarted(EMPTY_STATS)), 2)

    expect(stats).toMatchObject({ wallsBuilt: 2, wallsBroken: 2 })
  })

  it('keeps the biggest capture, the tightest trap and the most regions in one wall', () => {
    let stats = statsAfterCapture(EMPTY_STATS, { percentGained: 22, capturedRegions: 1, tightestRegionPct: 40 })
    stats = statsAfterCapture(stats, { percentGained: 9, capturedRegions: 3, tightestRegionPct: 2.5 })
    stats = statsAfterCapture(stats, { percentGained: 12, capturedRegions: 0, tightestRegionPct: null })

    expect(stats).toMatchObject({ biggestCapturePct: 22, tightestTrapPct: 2.5, maxRegionsInOneWall: 3 })
  })

  it('records level clears: best percent, fastest pace, fewest walls and flawless streaks', () => {
    let stats = statsAfterLevelClear(EMPTY_STATS, clear({ percent: 91.5, elapsedMs: 20_000 }))
    stats = statsAfterLevelClear(stats, clear({ percent: 78, wallsUsed: 4 }))
    stats = statsAfterLevelClear(stats, clear({ livesLost: 1, wallsUsed: 2, orbCount: 2 }))
    stats = statsAfterLevelClear(stats, clear())

    expect(stats).toMatchObject({
      levelsCleared: 4,
      bestClearPct: 91.5,
      fastestClearRatio: 0.5,
      fewestWallsClear: 4,
      perfectStreak: 1,
      bestPerfectStreak: 2,
    })
  })

  it('never mutates the previous stats', () => {
    const before = EMPTY_STATS

    statsAfterLevelClear(before, clear())

    expect(before.levelsCleared).toBe(0)
  })
})
