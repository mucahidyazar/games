import { boardById, leaderboardQuerySchema, type LeaderboardEntry, type LeaderboardResponse } from '@games/contract'
import { eq, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { loadSession } from '../auth/session'
import { profile, record } from '../db/schema'
import type { Database } from '../db/types'
import type { AppDeps } from '../deps'
import { describeIssues } from '../http/body'
import type { AppEnv } from '../http/context'
import { HttpError } from '../http/errors'
import { addressKey, createRateLimiter, rateLimit } from '../security/rate-limit'
import { resolveBoardKey } from './query'
import { type Direction, findStanding, leaderboardOrder, rankOf, rankOrderSql } from './ranking'

export const LEADERBOARD_SIZE = 50

async function topEntries(db: Database, key: string, direction: Direction): Promise<LeaderboardEntry[]> {
  const rows = await db
    .select({
      rank: sql<number>`(rank() over (order by ${rankOrderSql(direction)}))::int`.mapWith(Number),
      nickname: profile.nickname,
      value: record.value,
      level: record.level,
      achievedAt: record.achievedAt,
    })
    .from(record)
    .innerJoin(profile, eq(profile.userId, record.userId))
    .where(eq(record.boardKey, key))
    .orderBy(...leaderboardOrder(direction))
    .limit(LEADERBOARD_SIZE)
  return rows.map((row) => ({ ...row, achievedAt: row.achievedAt.toISOString() }))
}

async function myStanding(db: Database, key: string, direction: Direction, userId: string): Promise<LeaderboardResponse['me']> {
  const standing = await findStanding(db, key, userId)
  if (!standing) return null
  return { rank: await rankOf(db, key, direction, standing), value: standing.value }
}

export function leaderboardRoutes(deps: AppDeps): Hono<AppEnv> {
  const db = deps.database.db
  const routes = new Hono<AppEnv>()
  // Public and cheap to call, so limited per client address, before any session lookup.
  const limit = rateLimit(createRateLimiter(deps.rateLimits.leaderboards), deps.clock, addressKey)

  routes.get('/leaderboards', limit, loadSession(deps.auth), async (c) => {
    const parsed = leaderboardQuerySchema.safeParse(c.req.query())
    if (!parsed.success) throw new HttpError(400, 'invalid_query', describeIssues(parsed.error))
    const { board, period } = parsed.data
    const key = resolveBoardKey(parsed.data, deps.clock.now())
    if (!key) throw new HttpError(400, 'invalid_query', `${board} has no ${period} table for that date.`)

    const { direction } = boardById(board)
    const user = c.get('user')
    const body: LeaderboardResponse = {
      board,
      period,
      key,
      entries: await topEntries(db, key, direction),
      me: user ? await myStanding(db, key, direction, user.id) : null,
    }
    return c.json(body)
  })

  return routes
}
