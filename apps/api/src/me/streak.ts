import { addDays } from '../lib/dates'

/**
 * Consecutive UTC days with a finished ranked Daily Challenge, counting back
 * from today — or from yesterday, so the streak survives until today's is played.
 */
export function dailyStreak(playedDays: readonly string[], today: string): number {
  const played = new Set(playedDays)
  let day = played.has(today) ? today : addDays(today, -1)
  let streak = 0
  while (played.has(day)) {
    streak += 1
    day = addDays(day, -1)
  }
  return streak
}
