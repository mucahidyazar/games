import { badgeIdSchema, badgeTierSchema, boardIdSchema, type MeResponse } from '@games/contract'
import { asc, eq } from 'drizzle-orm'
import { badge, record, user } from '../db/schema'
import type { Database } from '../db/types'

/** The player's badges; unknown ids (e.g. retired badges) are skipped rather than failing the page. */
export async function listBadges(db: Database, userId: string): Promise<MeResponse['badges']> {
  const rows = await db
    .select({ id: badge.badgeId, tier: badge.tier, earnedAt: badge.earnedAt })
    .from(badge)
    .where(eq(badge.userId, userId))
    .orderBy(asc(badge.earnedAt), asc(badge.badgeId))
  return rows.flatMap((row) => {
    const id = badgeIdSchema.safeParse(row.id)
    const tier = badgeTierSchema.safeParse(row.tier)
    return id.success && tier.success ? [{ id: id.data, tier: tier.data, earnedAt: row.earnedAt.toISOString() }] : []
  })
}

/** Every table the player holds a record on; the board is the key's prefix (score.classic:week:2026-W39). */
export async function listRecords(db: Database, userId: string): Promise<MeResponse['records']> {
  const rows = await db
    .select({ key: record.boardKey, value: record.value, achievedAt: record.achievedAt })
    .from(record)
    .where(eq(record.userId, userId))
    .orderBy(asc(record.boardKey))
  return rows.flatMap((row) => {
    const board = boardIdSchema.safeParse(row.key.split(':')[0])
    return board.success ? [{ board: board.data, key: row.key, value: row.value, achievedAt: row.achievedAt.toISOString() }] : []
  })
}

/** Deletes the account; foreign keys cascade to sessions, accounts, the profile, runs, records and badges. */
export async function deleteUser(db: Database, userId: string): Promise<void> {
  await db.delete(user).where(eq(user.id, userId))
}
