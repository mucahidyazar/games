import { and, eq, ne, sql } from 'drizzle-orm'
import { isUniqueViolation } from '../db/errors'
import { profile } from '../db/schema'
import type { Database } from '../db/types'

export async function findNickname(db: Database, userId: string): Promise<string | null> {
  const [row] = await db.select({ nickname: profile.nickname }).from(profile).where(eq(profile.userId, userId)).limit(1)
  return row?.nickname ?? null
}

export type SaveNicknameResult = 'saved' | 'taken'

/** Creates or renames the player's profile. Nicknames are unique regardless of case. */
export async function saveNickname(db: Database, userId: string, nickname: string, now: Date): Promise<SaveNicknameResult> {
  const [owner] = await db
    .select({ userId: profile.userId })
    .from(profile)
    .where(and(sql`lower(${profile.nickname}) = lower(${nickname})`, ne(profile.userId, userId)))
    .limit(1)
  if (owner) return 'taken'

  try {
    await db
      .insert(profile)
      .values({ userId, nickname, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({ target: profile.userId, set: { nickname, updatedAt: now } })
    return 'saved'
  } catch (error) {
    // Someone claimed the same name between the check and the write.
    if (isUniqueViolation(error)) return 'taken'
    throw error
  }
}
