import type { BoardDefinition } from '@games/contract'
import { and, asc, count, desc, eq, gt, lt, or, sql, type SQL } from 'drizzle-orm'
import { profile, record } from '../db/schema'
import type { Database } from '../db/types'

export type Direction = BoardDefinition['direction']

/** A player's best on one table. */
export interface Standing {
  readonly value: number
  readonly achievedAt: Date
}

/** Leaderboard order: best value first; the same value reached earlier ranks higher. */
export function leaderboardOrder(direction: Direction): SQL[] {
  return [direction === 'desc' ? desc(record.value) : asc(record.value), asc(record.achievedAt), asc(record.userId)]
}

/** The same order as a window-function clause, for rank(). */
export function rankOrderSql(direction: Direction): SQL {
  return direction === 'desc'
    ? sql`${record.value} desc, ${record.achievedAt} asc`
    : sql`${record.value} asc, ${record.achievedAt} asc`
}

/**
 * Rows ranked strictly ahead of a standing: a better value, or the same value
 * reached earlier. Typed operators (not raw `sql`) so each parameter goes
 * through its column's encoder — postgres.js rejects a raw Date parameter.
 */
function aheadOf(direction: Direction, { value, achievedAt }: Standing): SQL {
  const better = direction === 'desc' ? gt(record.value, value) : lt(record.value, value)
  return or(better, and(eq(record.value, value), lt(record.achievedAt, achievedAt))) ?? better
}

/** 1 + the number of players ranked strictly ahead (players without a nickname are not listed, so not counted). */
export async function rankOf(db: Database, key: string, direction: Direction, standing: Standing): Promise<number> {
  const [row] = await db
    .select({ ahead: count() })
    .from(record)
    .innerJoin(profile, eq(profile.userId, record.userId))
    .where(and(eq(record.boardKey, key), aheadOf(direction, standing)))
  return 1 + (row?.ahead ?? 0)
}

export async function findStanding(db: Database, key: string, userId: string): Promise<Standing | null> {
  const [row] = await db
    .select({ value: record.value, achievedAt: record.achievedAt })
    .from(record)
    .where(and(eq(record.boardKey, key), eq(record.userId, userId)))
    .limit(1)
  return row ?? null
}
