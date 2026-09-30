import type { GameMode } from '@games/trap-the-orb-engine'

export type BoardId =
  | 'score.classic'
  | 'score.daily'
  | 'score.timeAttack'
  | 'score.limitedWalls'
  | 'score.hardcore'
  | 'stat.tightestTrap'
  | 'stat.biggestCapture'
  | 'stat.flawlessStreak'
  | 'stat.badges'

export type BoardPeriod = 'day' | 'week' | 'all'

export interface BoardDefinition {
  readonly id: BoardId
  readonly kind: 'score' | 'stat'
  /** Score boards belong to one ranked mode; record boards span every ranked mode. */
  readonly mode: GameMode | null
  /** 'desc': higher is better. 'asc': lower is better. */
  readonly direction: 'desc' | 'asc'
  readonly unit: 'points' | 'percent' | 'count'
}

/**
 * Every leaderboard. Scores never mix across modes, and only ranked modes —
 * fixed rules, replay-verified on the server — can appear here.
 */
export const BOARDS: readonly BoardDefinition[] = [
  { id: 'score.classic', kind: 'score', mode: 'classic', direction: 'desc', unit: 'points' },
  { id: 'score.daily', kind: 'score', mode: 'daily', direction: 'desc', unit: 'points' },
  { id: 'score.timeAttack', kind: 'score', mode: 'timeAttack', direction: 'desc', unit: 'points' },
  { id: 'score.limitedWalls', kind: 'score', mode: 'limitedWalls', direction: 'desc', unit: 'points' },
  { id: 'score.hardcore', kind: 'score', mode: 'hardcore', direction: 'desc', unit: 'points' },
  { id: 'stat.tightestTrap', kind: 'stat', mode: null, direction: 'asc', unit: 'percent' },
  { id: 'stat.biggestCapture', kind: 'stat', mode: null, direction: 'desc', unit: 'percent' },
  { id: 'stat.flawlessStreak', kind: 'stat', mode: null, direction: 'desc', unit: 'count' },
  { id: 'stat.badges', kind: 'stat', mode: null, direction: 'desc', unit: 'count' },
]

export const BOARD_IDS: readonly BoardId[] = BOARDS.map((board) => board.id)

export function boardById(id: BoardId): BoardDefinition {
  const board = BOARDS.find((candidate) => candidate.id === id)
  if (!board) throw new RangeError(`Unknown board: ${id}`)
  return board
}

/** Daily boards reset every day; score boards have weekly and all-time tables; record boards are all-time. */
export function periodsFor(board: BoardDefinition): readonly BoardPeriod[] {
  if (board.mode === 'daily') return ['day']
  return board.kind === 'score' ? ['week', 'all'] : ['all']
}

/** Calendar day in UTC, e.g. 2026-09-24. */
export function utcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

const DAY_MS = 86_400_000

/** ISO-8601 week in UTC, e.g. 2026-W39. Weeks start on Monday and belong to the year of their Thursday. */
export function isoWeekKey(date: Date): string {
  const midnight = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  const weekday = new Date(midnight).getUTCDay() || 7
  const thursday = new Date(midnight + (4 - weekday) * DAY_MS)
  const yearStart = Date.UTC(thursday.getUTCFullYear(), 0, 1)
  const week = Math.ceil(((thursday.getTime() - yearStart) / DAY_MS + 1) / 7)
  return `${thursday.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

/** Storage key of one table: board, period and — for day/week tables — which day or week. */
export function boardKey(boardId: BoardId, period: BoardPeriod, at: Date): string {
  const board = boardById(boardId)
  if (!periodsFor(board).includes(period)) throw new RangeError(`${boardId} has no ${period} table`)
  if (period === 'all') return `${boardId}:all`
  return `${boardId}:${period}:${period === 'day' ? utcDateKey(at) : isoWeekKey(at)}`
}
