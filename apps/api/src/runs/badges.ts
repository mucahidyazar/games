import { badgeById, evaluateRunBadges, tierFor, type EarnedBadge, type GameMode, type RunStats } from '@games/trap-the-orb-engine'

/**
 * Badges a finished ranked run qualifies for: the engine's run badges plus
 * Devotee, which is earned from the Daily Challenge streak.
 */
export function badgesForRun(stats: RunStats, mode: GameMode, dailyStreak: number): EarnedBadge[] {
  const runBadges = evaluateRunBadges(stats, mode)
  if (mode !== 'daily') return runBadges
  const devoteeTier = tierFor(badgeById('devotee'), dailyStreak)
  return devoteeTier === 0 ? runBadges : [...runBadges, { id: 'devotee', tier: devoteeTier }]
}
