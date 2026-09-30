import { boardById, isoWeekKey, utcDateKey, type BoardId, type BoardPeriod } from '@games/contract'
import type { GameMode } from '@games/trap-the-orb-engine'
import { formatNumber } from '@/lib/format'
import { gamePaths } from '../game'

export interface BoardContent {
  readonly name: string
  /** What the board ranks, in one short line. */
  readonly description: string
  /** Column heading of the ranked value. */
  readonly valueLabel: string
}

export const BOARD_CONTENT: Readonly<Record<BoardId, BoardContent>> = {
  'score.classic': { name: 'Classic', description: 'Highest scores in Classic.', valueLabel: 'Score' },
  'score.daily': { name: 'Daily', description: 'First attempts at today’s shared layout.', valueLabel: 'Score' },
  'score.timeAttack': { name: 'Time Attack', description: 'Highest scores against the clock.', valueLabel: 'Score' },
  'score.limitedWalls': {
    name: 'Limited Walls',
    description: 'Highest scores with a wall budget.',
    valueLabel: 'Score',
  },
  'score.hardcore': { name: 'Hardcore', description: 'Highest scores with a single life.', valueLabel: 'Score' },
  'stat.tightestTrap': {
    name: 'Tightest trap',
    description: 'The smallest space an orb was ever boxed into.',
    valueLabel: 'Space',
  },
  'stat.biggestCapture': {
    name: 'Biggest capture',
    description: 'The most field claimed with a single wall.',
    valueLabel: 'Claimed',
  },
  'stat.flawlessStreak': {
    name: 'Flawless streak',
    description: 'Most levels cleared in a row without losing a life.',
    valueLabel: 'Levels',
  },
  'stat.badges': { name: 'Badges', description: 'Most badge tiers earned.', valueLabel: 'Tiers' },
}

export const SCORE_BOARDS: readonly BoardId[] = [
  'score.classic',
  'score.daily',
  'score.timeAttack',
  'score.limitedWalls',
  'score.hardcore',
]

export const RECORD_BOARDS: readonly BoardId[] = [
  'stat.tightestTrap',
  'stat.biggestCapture',
  'stat.flawlessStreak',
  'stat.badges',
]

export const PERIOD_LABELS: Readonly<Record<BoardPeriod, string>> = {
  day: 'Today',
  week: 'This week',
  all: 'All time',
}

/** A board value in its unit: points, a percentage of the field, or a count. */
export function formatBoardValue(board: BoardId, value: number): string {
  switch (boardById(board).unit) {
    case 'percent':
      return `${value < 10 ? value.toFixed(2) : value.toFixed(1)}%`
    case 'points':
    case 'count':
      return formatNumber(value)
  }
}

/** The score board of a ranked mode; null for the unranked ones. */
export function scoreBoardFor(mode: GameMode): BoardId | null {
  const board = SCORE_BOARDS.find((id) => boardById(id).mode === mode)
  return board ?? null
}

/** The table a mode's players care about right now: today for Daily, this week otherwise. */
export function defaultPeriodFor(board: BoardId): BoardPeriod {
  const definition = boardById(board)
  if (definition.mode === 'daily') return 'day'
  return definition.kind === 'score' ? 'week' : 'all'
}

/** Link to a table on the leaderboards page. */
export function leaderboardsHref(board: BoardId, period: BoardPeriod = defaultPeriodFor(board)): string {
  const params = new URLSearchParams({ board, period })
  return gamePaths.leaderboards(`?${params.toString()}`)
}

const dayFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })

/** "All time", "This week", "Week 38, 2026", "Today" or "Sep 21" for a record's table key. */
export function tableLabel(key: string, now: Date): string {
  const [, period, id = ''] = key.split(':')
  if (period === 'week') {
    if (id === isoWeekKey(now)) return 'This week'
    const [year, week] = id.split('-W')
    return `Week ${Number(week)}, ${year}`
  }
  if (period === 'day') {
    if (id === utcDateKey(now)) return 'Today'
    const time = Date.parse(`${id}T00:00:00Z`)
    return Number.isFinite(time) ? dayFormatter.format(time) : id
  }
  return 'All time'
}
