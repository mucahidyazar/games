import {
  fieldSchema,
  rankedModeSchema,
  utcDateKey,
  type FinishRunRequest,
  type FinishRunResponse,
  type StartRunRequest,
  type StartRunResponse,
} from '@games/contract'
import { dailySeed, type ReplayResult } from '@games/trap-the-orb-engine'
import { isUniqueViolation } from '../db/errors'
import type { Database } from '../db/types'
import type { Clock } from '../http/context'
import { HttpError } from '../http/errors'
import type { Logger } from '../logger'
import { dailyStreak } from '../me/streak'
import { badgesForRun } from './badges'
import { recordCandidates } from './records'
import {
  abandonActiveRuns,
  completeRun,
  findRun,
  hasFinishedRankedDaily,
  hasRankedDailyAttempt,
  insertRun,
  markAbandoned,
  rankedDailyDays,
  type RunRow,
} from './repository'
import { awardBadges, badgeTotal, saveRecords } from './progress'
import { isExpired, isPlausible, secondsBetween } from './timing'
import { verifyRun } from './verify'

export interface RunServiceDeps {
  readonly db: Database
  readonly clock: Clock
  readonly logger: Logger
}

function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] ?? 0
}

/**
 * Starts a ranked run: closes any run the player left open and picks the seed.
 * A Daily Challenge is ranked only if it is the player's first attempt that day.
 */
export async function startRun({ db, clock }: RunServiceDeps, userId: string, { mode, field }: StartRunRequest): Promise<StartRunResponse> {
  const now = clock.now()
  const dailyDate = mode === 'daily' ? utcDateKey(now) : null
  const seed = dailyDate ? dailySeed(dailyDate) : randomSeed()

  const attempt = () =>
    db.transaction(async (tx) => {
      await abandonActiveRuns(tx, userId)
      const ranked = dailyDate ? !(await hasRankedDailyAttempt(tx, userId, dailyDate)) : true
      const runId = await insertRun(tx, { userId, mode, field, seed, dailyDate, ranked, startedAt: now })
      return { runId, ranked }
    })

  let started: { runId: string; ranked: boolean }
  try {
    started = await attempt()
  } catch (error) {
    // Two starts raced; the one-active-run index rejected the second. Retry once now that the first is visible.
    if (!isUniqueViolation(error)) throw error
    started = await attempt()
  }
  return { runId: started.runId, seed, mode, field, dailyDate, ranked: started.ranked }
}

const runNotFound = (): HttpError => new HttpError(404, 'run_not_found', 'This run does not exist.')

function replaySummary(result: ReplayResult): FinishRunResponse['result'] {
  const status = result.status === 'levelComplete' || result.status === 'gameOver' ? result.status : 'playing'
  return {
    status,
    gameOverReason: result.gameOverReason,
    score: result.score,
    level: result.level,
    levelsCleared: result.levelsCleared,
    stats: result.stats,
  }
}

/** Checks ownership, state and timing before any replay work is done. */
async function openRunFor({ db, clock }: RunServiceDeps, userId: string, runId: string, endTick: number): Promise<RunRow> {
  const row = await findRun(db, runId)
  if (!row || row.userId !== userId) throw runNotFound()
  if (row.status !== 'active') throw new HttpError(409, 'run_not_active', 'This run is already finished or abandoned.')
  const elapsed = secondsBetween(row.startedAt, clock.now())
  if (isExpired(elapsed)) {
    await markAbandoned(db, runId)
    throw new HttpError(409, 'run_expired', 'This run stayed open too long and was closed.')
  }
  if (!isPlausible(endTick, elapsed)) {
    throw new HttpError(422, 'run_implausible', 'The recording covers more time than has passed since the run started.')
  }
  return row
}

/**
 * Replays the recording from the server's seed, stores the authoritative
 * result and — for ranked runs — awards badges and updates leaderboards.
 */
export async function finishRun(deps: RunServiceDeps, userId: string, runId: string, request: FinishRunRequest): Promise<FinishRunResponse> {
  const row = await openRunFor(deps, userId, runId, request.endTick)
  const mode = rankedModeSchema.parse(row.mode)
  const field = fieldSchema.parse(row.field)

  const outcome = verifyRun({ mode, seed: row.seed, field, inputs: request.inputs, endTick: request.endTick })
  if (!outcome.ok) throw new HttpError(422, 'invalid_run', `The recording could not be replayed (${outcome.reason}).`)
  const { result } = outcome

  const mismatch = request.clientScore !== result.score || request.clientLevel !== result.level
  if (mismatch) {
    deps.logger.warn('client result differs from replay', {
      runId,
      mode,
      clientScore: request.clientScore,
      score: result.score,
      clientLevel: request.clientLevel,
      level: result.level,
    })
  }

  const now = deps.clock.now()
  return deps.db.transaction(async (tx) => {
    // A second Daily attempt that finished first would already own the day's ranked slot.
    const ranked = row.ranked && !(row.dailyDate && (await hasFinishedRankedDaily(tx, userId, row.dailyDate, runId)))
    const completed = await completeRun(tx, runId, {
      ranked,
      finishedAt: now,
      endTick: request.endTick,
      inputCount: request.inputs.length,
      score: result.score,
      level: result.level,
      levelsCleared: result.levelsCleared,
      stats: result.stats,
      clientScore: request.clientScore,
      clientLevel: request.clientLevel,
      mismatch,
    })
    if (!completed) throw new HttpError(409, 'run_not_active', 'This run is already finished or abandoned.')
    if (!ranked) return { result: replaySummary(result), ranked, newBadges: [], records: [] }

    const streak = mode === 'daily' ? dailyStreak(await rankedDailyDays(tx, userId), utcDateKey(now)) : 0
    const newBadges = await awardBadges(tx, userId, runId, badgesForRun(result.stats, mode, streak), now)
    const candidates = recordCandidates({
      mode,
      score: result.score,
      level: result.level,
      stats: result.stats,
      badgeTotal: await badgeTotal(tx, userId),
      finishedAt: now,
      dailyDate: row.dailyDate,
    })
    const records = await saveRecords(tx, userId, runId, candidates, now)
    return { result: replaySummary(result), ranked, newBadges, records }
  })
}
