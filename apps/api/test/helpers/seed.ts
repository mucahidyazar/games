import { profile, record, user } from '../../src/db/schema'
import type { Database } from '../../src/db/types'

/** Inserts a player straight into the database (no session), optionally with a nickname. */
export async function insertPlayer(db: Database, id: string, nickname: string | null): Promise<void> {
  const now = new Date()
  await db.insert(user).values({ id, name: id, email: `${id}@seed.example`, emailVerified: true, createdAt: now, updatedAt: now })
  if (nickname) await db.insert(profile).values({ userId: id, nickname })
}

export async function insertRecord(db: Database, userId: string, boardKey: string, value: number, achievedAt: Date, level: number | null = null): Promise<void> {
  await db.insert(record).values({ boardKey, userId, value, level, achievedAt })
}
