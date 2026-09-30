import { isRankedMode } from './modes'
import type { GameMode, RunStats } from './types'

export type BadgeId =
  | 'climber'
  | 'squeeze'
  | 'landGrab'
  | 'overachiever'
  | 'flawless'
  | 'lightning'
  | 'doubleTrap'
  | 'architect'
  | 'survivor'
  | 'beatTheClock'
  | 'frugal'
  | 'devotee'

/** 1 bronze, 2 silver, 3 gold. */
export type BadgeTier = 1 | 2 | 3

export interface BadgeDefinition {
  readonly id: BadgeId
  /** Higher values are better ('atLeast') or lower values are better ('atMost'). */
  readonly direction: 'atLeast' | 'atMost'
  /** Bronze, silver and gold thresholds. */
  readonly thresholds: readonly [number, number, number]
  /** Modes that count; 'ranked' means every ranked mode. */
  readonly modes: readonly GameMode[] | 'ranked'
  /** 'run' badges come from a single run's stats; 'account' badges are computed by the server. */
  readonly source: 'run' | 'account'
  readonly metric: (stats: RunStats) => number | null
}

export interface EarnedBadge {
  readonly id: BadgeId
  readonly tier: BadgeTier
}

const none = (): null => null

/** Badges are only awarded in ranked modes, so Custom and Zen cannot be farmed. */
export const BADGES: readonly BadgeDefinition[] = [
  { id: 'climber', direction: 'atLeast', thresholds: [5, 10, 20], modes: 'ranked', source: 'run', metric: (s) => s.highestLevel },
  { id: 'squeeze', direction: 'atMost', thresholds: [3, 1.5, 0.75], modes: 'ranked', source: 'run', metric: (s) => s.tightestTrapPct },
  { id: 'landGrab', direction: 'atLeast', thresholds: [25, 40, 60], modes: 'ranked', source: 'run', metric: (s) => s.biggestCapturePct },
  { id: 'overachiever', direction: 'atLeast', thresholds: [90, 95, 99], modes: 'ranked', source: 'run', metric: (s) => s.bestClearPct },
  { id: 'flawless', direction: 'atLeast', thresholds: [1, 3, 5], modes: 'ranked', source: 'run', metric: (s) => s.bestPerfectStreak },
  { id: 'lightning', direction: 'atMost', thresholds: [0.6, 0.45, 0.3], modes: 'ranked', source: 'run', metric: (s) => s.fastestClearRatio },
  { id: 'doubleTrap', direction: 'atLeast', thresholds: [2, 3, 4], modes: 'ranked', source: 'run', metric: (s) => s.maxRegionsInOneWall },
  { id: 'architect', direction: 'atMost', thresholds: [6, 4, 3], modes: 'ranked', source: 'run', metric: (s) => s.fewestWallsClear },
  { id: 'survivor', direction: 'atLeast', thresholds: [3, 6, 10], modes: ['hardcore'], source: 'run', metric: (s) => s.highestLevel },
  { id: 'beatTheClock', direction: 'atLeast', thresholds: [5, 10, 15], modes: ['timeAttack'], source: 'run', metric: (s) => s.highestLevel },
  { id: 'frugal', direction: 'atLeast', thresholds: [5, 10, 15], modes: ['limitedWalls'], source: 'run', metric: (s) => s.highestLevel },
  { id: 'devotee', direction: 'atLeast', thresholds: [3, 7, 30], modes: ['daily'], source: 'account', metric: none },
]

export function badgeById(id: BadgeId): BadgeDefinition {
  const badge = BADGES.find((candidate) => candidate.id === id)
  if (!badge) throw new Error(`Unknown badge: ${id}`)
  return badge
}

/** Highest tier a value reaches (0 when it reaches none). */
export function tierFor(badge: BadgeDefinition, value: number | null): BadgeTier | 0 {
  if (value === null || !Number.isFinite(value)) return 0
  let tier: BadgeTier | 0 = 0
  badge.thresholds.forEach((threshold, index) => {
    const reached = badge.direction === 'atLeast' ? value >= threshold : value <= threshold
    if (reached) tier = (index + 1) as BadgeTier
  })
  return tier
}

const countsIn = (badge: BadgeDefinition, mode: GameMode): boolean =>
  badge.modes === 'ranked' ? isRankedMode(mode) : badge.modes.includes(mode)

/** Badges a finished run earns, at the highest tier it reached. */
export function evaluateRunBadges(stats: RunStats, mode: GameMode): EarnedBadge[] {
  if (!isRankedMode(mode)) return []
  return BADGES.flatMap((badge) => {
    if (badge.source !== 'run' || !countsIn(badge, mode)) return []
    const tier = tierFor(badge, badge.metric(stats))
    return tier === 0 ? [] : [{ id: badge.id, tier }]
  })
}
