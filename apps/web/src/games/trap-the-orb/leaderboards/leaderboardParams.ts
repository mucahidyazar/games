import { BOARD_IDS, boardById, periodsFor, utcDateKey, type BoardId, type BoardPeriod } from '@games/contract'
import { defaultPeriodFor } from './boardContent'

export type LeaderboardTab = 'scores' | 'records' | 'device'

export interface LeaderboardParams {
  readonly tab: LeaderboardTab
  readonly board: BoardId
  readonly period: BoardPeriod
  /** A past day of the Daily board (YYYY-MM-DD); undefined means today. */
  readonly date: string | undefined
}

const DEFAULT_BOARD: BoardId = 'score.classic'
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const DAY_MS = 86_400_000

const isBoardId = (value: string | null): value is BoardId =>
  value !== null && (BOARD_IDS as readonly string[]).includes(value)

/** Reads the leaderboard page state from the query string, repairing anything invalid. */
export function parseLeaderboardParams(search: string): LeaderboardParams {
  const params = new URLSearchParams(search)
  const rawBoard = params.get('board')
  const board = isBoardId(rawBoard) ? rawBoard : DEFAULT_BOARD
  const definition = boardById(board)
  const rawPeriod = params.get('period')
  const period = periodsFor(definition).find((candidate) => candidate === rawPeriod) ?? defaultPeriodFor(board)
  const rawDate = params.get('date')
  const date = period === 'day' && rawDate && DATE_PATTERN.test(rawDate) ? rawDate : undefined
  const tab: LeaderboardTab =
    params.get('tab') === 'device' ? 'device' : definition.kind === 'stat' ? 'records' : 'scores'
  return { tab, board, period, date }
}

export function leaderboardSearch({ tab, board, period, date }: LeaderboardParams): string {
  if (tab === 'device') return '?tab=device'
  const params = new URLSearchParams({ board, period })
  if (date) params.set('date', date)
  return `?${params.toString()}`
}

/** Yesterday in UTC, for the Daily board's "Yesterday" table. */
export function yesterdayKey(now: Date): string {
  return utcDateKey(new Date(now.getTime() - DAY_MS))
}
