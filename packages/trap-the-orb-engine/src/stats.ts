import type { RunStats } from './types'

export const EMPTY_STATS: RunStats = {
  levelsCleared: 0,
  highestLevel: 1,
  wallsBuilt: 0,
  wallsBroken: 0,
  tightestTrapPct: null,
  biggestCapturePct: 0,
  bestClearPct: null,
  perfectStreak: 0,
  bestPerfectStreak: 0,
  fastestClearRatio: null,
  maxRegionsInOneWall: 0,
  fewestWallsClear: null,
}

/** Levels need at least this many orbs before "fewest walls" counts — one orb is too easy to box in. */
const MIN_ORBS_FOR_WALL_RECORD = 3

const lowest = (current: number | null, candidate: number | null): number | null =>
  candidate === null ? current : current === null ? candidate : Math.min(current, candidate)

export function statsAfterLevelStart(stats: RunStats, level: number): RunStats {
  return level > stats.highestLevel ? { ...stats, highestLevel: level } : stats
}

export function statsAfterWallStarted(stats: RunStats): RunStats {
  return { ...stats, wallsBuilt: stats.wallsBuilt + 1 }
}

export function statsAfterWallsBroken(stats: RunStats, halves: number): RunStats {
  return { ...stats, wallsBroken: stats.wallsBroken + halves }
}

export interface CaptureMoment {
  /** Share of the field claimed by this wall, walls included (%). */
  readonly percentGained: number
  readonly capturedRegions: number
  /** Smallest region still holding an orb after this wall (%), or null when unknown. */
  readonly tightestRegionPct: number | null
}

export function statsAfterCapture(stats: RunStats, moment: CaptureMoment): RunStats {
  return {
    ...stats,
    biggestCapturePct: Math.max(stats.biggestCapturePct, moment.percentGained),
    maxRegionsInOneWall: Math.max(stats.maxRegionsInOneWall, moment.capturedRegions),
    tightestTrapPct: lowest(stats.tightestTrapPct, moment.tightestRegionPct),
  }
}

export interface LevelClear {
  readonly percent: number
  readonly elapsedMs: number
  readonly parSeconds: number
  readonly livesLost: number
  readonly wallsUsed: number
  readonly orbCount: number
}

export function statsAfterLevelClear(stats: RunStats, clear: LevelClear): RunStats {
  const perfectStreak = clear.livesLost === 0 ? stats.perfectStreak + 1 : 0
  const ratio = clear.parSeconds > 0 ? clear.elapsedMs / (clear.parSeconds * 1000) : null

  return {
    ...stats,
    levelsCleared: stats.levelsCleared + 1,
    bestClearPct: stats.bestClearPct === null ? clear.percent : Math.max(stats.bestClearPct, clear.percent),
    perfectStreak,
    bestPerfectStreak: Math.max(stats.bestPerfectStreak, perfectStreak),
    fastestClearRatio: lowest(stats.fastestClearRatio, ratio),
    fewestWallsClear:
      clear.orbCount >= MIN_ORBS_FOR_WALL_RECORD ? lowest(stats.fewestWallsClear, clear.wallsUsed) : stats.fewestWallsClear,
  }
}
