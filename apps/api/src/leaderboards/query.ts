import { boardKey, type LeaderboardQuery } from '@games/contract'
import { parseIsoDate } from '../lib/dates'

/**
 * The storage key of the requested table. Day and week tables use `date`
 * (default: today, UTC). Null when the date is impossible or the board has no
 * such period (e.g. a weekly table of a record board).
 */
export function resolveBoardKey({ board, period, date }: LeaderboardQuery, now: Date): string | null {
  const at = date === undefined ? now : parseIsoDate(date)
  if (!at) return null
  try {
    return boardKey(board, period, at)
  } catch (error) {
    if (error instanceof RangeError) return null
    throw error
  }
}
