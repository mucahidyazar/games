import { BOARDS, boardKey, periodsFor, type BoardDefinition, type BoardId, type BoardPeriod } from '@games/contract'
import type { GameMode, RunStats } from '@games/trap-the-orb-engine'
import { parseIsoDate } from '../lib/dates'

/** A value a finished run puts forward on one leaderboard table. */
export interface RecordCandidate {
  readonly board: BoardId
  readonly period: BoardPeriod
  readonly key: string
  readonly direction: BoardDefinition['direction']
  readonly value: number
  /** Level reached, for score tables. */
  readonly level: number | null
}

export interface RecordSource {
  readonly mode: GameMode
  readonly score: number
  readonly level: number
  readonly stats: RunStats
  /** Sum of the player's badge tiers after this run's awards. */
  readonly badgeTotal: number
  readonly finishedAt: Date
  /** Daily Challenge day; its table is keyed by the day the run started. */
  readonly dailyDate: string | null
}

type StatBoardId = Exclude<BoardId, `score.${string}`>

/** Record boards; null (or nothing achieved) means the run puts nothing forward. */
const STAT_VALUES: Readonly<Record<StatBoardId, (source: RecordSource) => number | null>> = {
  'stat.tightestTrap': ({ stats }) => stats.tightestTrapPct,
  'stat.biggestCapture': ({ stats }) => (stats.biggestCapturePct > 0 ? stats.biggestCapturePct : null),
  'stat.flawlessStreak': ({ stats }) => (stats.bestPerfectStreak > 0 ? stats.bestPerfectStreak : null),
  'stat.badges': ({ badgeTotal }) => (badgeTotal > 0 ? badgeTotal : null),
}

function valueFor(board: BoardDefinition, source: RecordSource): { value: number; level: number | null } | null {
  if (board.kind === 'score') return board.mode === source.mode ? { value: source.score, level: source.level } : null
  const value = STAT_VALUES[board.id as StatBoardId](source)
  return value === null ? null : { value, level: null }
}

/** Every (board, period) table a ranked run competes on, with the value it brings. */
export function recordCandidates(source: RecordSource): RecordCandidate[] {
  const dailyStart = source.dailyDate ? parseIsoDate(source.dailyDate) : null
  return BOARDS.flatMap((board) => {
    const entry = valueFor(board, source)
    if (!entry) return []
    return periodsFor(board).map((period) => {
      const at = period === 'day' && dailyStart ? dailyStart : source.finishedAt
      return { board: board.id, period, key: boardKey(board.id, period, at), direction: board.direction, ...entry }
    })
  })
}
