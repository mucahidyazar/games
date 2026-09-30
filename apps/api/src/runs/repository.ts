import type { RunStats } from '@games/trap-the-orb-engine'
import { and, desc, eq, ne } from 'drizzle-orm'
import { run } from '../db/schema'
import type { Database } from '../db/types'

export type RunRow = typeof run.$inferSelect

export interface NewRun {
  readonly userId: string
  readonly mode: string
  readonly field: string
  readonly seed: number
  readonly dailyDate: string | null
  readonly ranked: boolean
  readonly startedAt: Date
}

export interface CompletedRun {
  readonly ranked: boolean
  readonly finishedAt: Date
  readonly endTick: number
  readonly inputCount: number
  readonly score: number
  readonly level: number
  readonly levelsCleared: number
  readonly stats: RunStats
  readonly clientScore: number
  readonly clientLevel: number
  readonly mismatch: boolean
}

/** Closes every run the player left open. */
export async function abandonActiveRuns(db: Database, userId: string): Promise<void> {
  await db
    .update(run)
    .set({ status: 'abandoned' })
    .where(and(eq(run.userId, userId), eq(run.status, 'active')))
}

export async function insertRun(db: Database, values: NewRun): Promise<string> {
  const [row] = await db.insert(run).values(values).returning({ id: run.id })
  if (!row) throw new Error('Inserting a run returned no row')
  return row.id
}

export async function findRun(db: Database, runId: string): Promise<RunRow | null> {
  const [row] = await db.select().from(run).where(eq(run.id, runId)).limit(1)
  return row ?? null
}

export async function markAbandoned(db: Database, runId: string): Promise<void> {
  await db
    .update(run)
    .set({ status: 'abandoned' })
    .where(and(eq(run.id, runId), eq(run.status, 'active')))
}

/** Stores the verified result. False when the run was no longer active (finished or abandoned meanwhile). */
export async function completeRun(db: Database, runId: string, result: CompletedRun): Promise<boolean> {
  const rows = await db
    .update(run)
    .set({ ...result, status: 'finished' })
    .where(and(eq(run.id, runId), eq(run.status, 'active')))
    .returning({ id: run.id })
  return rows.length > 0
}

const rankedDailyFinish = (userId: string) =>
  and(eq(run.userId, userId), eq(run.mode, 'daily'), eq(run.status, 'finished'), eq(run.ranked, true))

/** Whether the player already has a ranked Daily Challenge result for that day (other than `exceptRunId`). */
export async function hasFinishedRankedDaily(db: Database, userId: string, dailyDate: string, exceptRunId?: string): Promise<boolean> {
  const [row] = await db
    .select({ id: run.id })
    .from(run)
    .where(and(rankedDailyFinish(userId), eq(run.dailyDate, dailyDate), exceptRunId ? ne(run.id, exceptRunId) : undefined))
    .limit(1)
  return row !== undefined
}

/**
 * Whether the player already used that day's ranked Daily Challenge attempt. The first attempt
 * holds the slot whatever happens to it, so abandoning a bad start never buys a second ranked try.
 */
export async function hasRankedDailyAttempt(db: Database, userId: string, dailyDate: string): Promise<boolean> {
  const [row] = await db
    .select({ id: run.id })
    .from(run)
    .where(and(eq(run.userId, userId), eq(run.mode, 'daily'), eq(run.dailyDate, dailyDate), eq(run.ranked, true)))
    .limit(1)
  return row !== undefined
}

/** Days (YYYY-MM-DD, newest first) on which the player finished a ranked Daily Challenge. */
export async function rankedDailyDays(db: Database, userId: string): Promise<string[]> {
  const rows = await db
    .selectDistinct({ day: run.dailyDate })
    .from(run)
    .where(rankedDailyFinish(userId))
    .orderBy(desc(run.dailyDate))
  return rows.flatMap((row) => (row.day ? [row.day] : []))
}
