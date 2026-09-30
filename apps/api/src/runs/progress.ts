import type { RecordUpdate } from '@games/contract'
import type { EarnedBadge } from '@games/trap-the-orb-engine'
import { eq, sql } from 'drizzle-orm'
import { badge, record } from '../db/schema'
import type { Database } from '../db/types'
import { type Direction, findStanding, rankOf } from '../leaderboards/ranking'
import type { RecordCandidate } from './records'

/**
 * Inserts new badges and raises tiers; a lower tier never replaces a higher
 * one. Returns the badges that were new or upgraded by this run.
 */
export async function awardBadges(db: Database, userId: string, runId: string, earned: readonly EarnedBadge[], now: Date): Promise<EarnedBadge[]> {
  if (earned.length === 0) return []
  const changed = await db
    .insert(badge)
    .values(earned.map(({ id, tier }) => ({ userId, badgeId: id, tier, runId, earnedAt: now })))
    .onConflictDoUpdate({
      target: [badge.userId, badge.badgeId],
      set: { tier: sql`excluded.tier`, runId: sql`excluded.run_id`, earnedAt: sql`excluded.earned_at` },
      setWhere: sql`${badge.tier} < excluded.tier`,
    })
    .returning({ badgeId: badge.badgeId })
  const changedIds = new Set(changed.map((row) => row.badgeId))
  return earned.filter(({ id }) => changedIds.has(id))
}

/** Sum of the player's badge tiers (bronze 1, silver 2, gold 3). */
export async function badgeTotal(db: Database, userId: string): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${badge.tier}), 0)::int`.mapWith(Number) })
    .from(badge)
    .where(eq(badge.userId, userId))
  return row?.total ?? 0
}

/** The stored value is replaced only by a strictly better one. */
const improves = (direction: Direction) =>
  direction === 'desc' ? sql`${record.value} < excluded.value` : sql`${record.value} > excluded.value`

async function saveRecord(db: Database, userId: string, runId: string, candidate: RecordCandidate, now: Date): Promise<RecordUpdate> {
  const saved = await db
    .insert(record)
    .values({ boardKey: candidate.key, userId, value: candidate.value, level: candidate.level, runId, achievedAt: now })
    .onConflictDoUpdate({
      target: [record.boardKey, record.userId],
      set: { value: sql`excluded.value`, level: sql`excluded.level`, runId: sql`excluded.run_id`, achievedAt: sql`excluded.achieved_at` },
      setWhere: improves(candidate.direction),
    })
    .returning({ value: record.value, achievedAt: record.achievedAt })

  const improved = saved.length > 0
  const standing = saved[0] ?? (await findStanding(db, candidate.key, userId))
  if (!standing) throw new Error(`Record ${candidate.key} vanished while saving`)
  const rank = await rankOf(db, candidate.key, candidate.direction, standing)
  return { board: candidate.board, period: candidate.period, key: candidate.key, value: standing.value, rank, improved }
}

/** Upserts every table the run competes on and reports the player's standing on each. */
export async function saveRecords(db: Database, userId: string, runId: string, candidates: readonly RecordCandidate[], now: Date): Promise<RecordUpdate[]> {
  const updates: RecordUpdate[] = []
  for (const candidate of candidates) {
    updates.push(await saveRecord(db, userId, runId, candidate, now))
  }
  return updates
}
