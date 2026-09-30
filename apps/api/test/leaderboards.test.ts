import { leaderboardResponseSchema, meResponseSchema, type LeaderboardResponse } from '@games/contract'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { user } from '../src/db/schema'
import { LEADERBOARD_SIZE } from '../src/leaderboards/routes'
import { createTestContext, type TestContext } from './helpers/context'
import { call, json, signUpPlayer, type Player } from './helpers/http'
import { insertPlayer, insertRecord } from './helpers/seed'

let ctx: TestContext
let me: Player
let myId: string

const T0 = new Date('2026-09-20T12:00:00Z')
const at = (minutes: number): Date => new Date(T0.getTime() + minutes * 60_000)

async function board(query: string, player?: Player): Promise<LeaderboardResponse> {
  const response = await call(ctx, 'GET', `/api/leaderboards?${query}`, { player })
  expect(response.status).toBe(200)
  return leaderboardResponseSchema.parse(await response.json())
}

beforeAll(async () => {
  ctx = await createTestContext({ now: new Date('2026-09-24T10:00:00Z'), rateLimits: { leaderboards: { limit: 60, windowMs: 60_000 } } })
  me = await signUpPlayer(ctx, 'Me Myself')
  const body = meResponseSchema.parse(await json(await call(ctx, 'GET', '/api/me', { player: me })))
  myId = body.user.id

  const db = ctx.database.db
  // 55 rivals on the all-time Classic table, scores 1000, 990, … so the signed-in player sits below the top 50.
  for (let index = 0; index < 55; index++) {
    await insertPlayer(db, `rival-${index}`, `Rival ${index}`)
    await insertRecord(db, `rival-${index}`, 'score.classic:all', 1000 - index * 10, at(index), 3)
  }
  await insertRecord(db, myId, 'score.classic:all', 5, at(100), 1)

  // A tie on 500 points: the earlier record ranks first.
  await insertPlayer(db, 'tie-late', 'Tie Late')
  await insertPlayer(db, 'tie-early', 'Tie Early')
  await insertRecord(db, 'tie-late', 'score.classic:week:2026-W39', 500, at(10))
  await insertRecord(db, 'tie-early', 'score.classic:week:2026-W39', 500, at(5))
  await insertRecord(db, myId, 'score.classic:week:2026-W39', 700, at(20))

  // Tightest trap: lower is better.
  await insertRecord(db, 'rival-1', 'stat.tightestTrap:all', 2.5, at(1))
  await insertRecord(db, 'rival-2', 'stat.tightestTrap:all', 0.8, at(2))
  await insertRecord(db, myId, 'stat.tightestTrap:all', 1.2, at(3))

  // A player who never picked a nickname stays off the boards.
  await insertPlayer(db, 'ghost', null)
  await insertRecord(db, 'ghost', 'stat.tightestTrap:all', 0.1, at(4))

  await insertRecord(db, 'rival-3', 'score.daily:day:2026-09-24', 300, at(0))
  await insertRecord(db, 'rival-4', 'score.daily:day:2026-09-23', 250, at(0))
})

afterAll(async () => {
  await ctx.close()
})

describe('GET /api/leaderboards', () => {
  it('lists the top 50 by score with nicknames, levels and ranks', async () => {
    const body = await board('board=score.classic&period=all')
    expect(body.key).toBe('score.classic:all')
    expect(body.entries).toHaveLength(LEADERBOARD_SIZE)
    expect(body.entries[0]).toEqual({ rank: 1, nickname: 'Rival 0', value: 1000, level: 3, achievedAt: at(0).toISOString() })
    expect(body.entries.map((entry) => entry.rank)).toEqual(Array.from({ length: LEADERBOARD_SIZE }, (_, index) => index + 1))
    expect(body.me).toBeNull()
  })

  it("includes the signed-in player's own rank, even outside the top 50", async () => {
    const body = await board('board=score.classic&period=all', me)
    expect(body.entries.some((entry) => entry.nickname === 'Me Myself')).toBe(false)
    expect(body.me).toEqual({ rank: 56, value: 5 })
  })

  it('breaks ties by who got there first', async () => {
    const body = await board('board=score.classic&period=week&date=2026-09-22', me)
    expect(body.key).toBe('score.classic:week:2026-W39')
    expect(body.entries.map((entry) => [entry.rank, entry.nickname])).toEqual([
      [1, 'Me Myself'],
      [2, 'Tie Early'],
      [3, 'Tie Late'],
    ])
    expect(body.me).toEqual({ rank: 1, value: 700 })
  })

  it('sorts lower-is-better boards ascending and skips players without a nickname', async () => {
    const body = await board('board=stat.tightestTrap&period=all', me)
    expect(body.entries.map((entry) => entry.value)).toEqual([0.8, 1.2, 2.5])
    expect(body.entries.every((entry) => entry.level === null)).toBe(true)
    expect(body.me).toEqual({ rank: 2, value: 1.2 })
  })

  it('shows today for daily tables unless another day is asked for', async () => {
    const today = await board('board=score.daily&period=day')
    expect(today.key).toBe('score.daily:day:2026-09-24')
    expect(today.entries.map((entry) => entry.value)).toEqual([300])

    const yesterday = await board('board=score.daily&period=day&date=2026-09-23')
    expect(yesterday.entries.map((entry) => entry.value)).toEqual([250])
  })

  it('returns an empty table when nobody has played it yet', async () => {
    const body = await board('board=score.hardcore&period=week', me)
    expect(body).toMatchObject({ key: 'score.hardcore:week:2026-W39', entries: [], me: null })
  })

  it('answers 400 for invalid queries', async () => {
    for (const query of [
      '',
      'board=score.nope&period=all',
      'board=score.classic&period=month',
      'board=score.daily&period=day&date=24-09-2026',
      'board=score.daily&period=day&date=2026-02-31',
      'board=stat.badges&period=week',
      'board=score.classic&period=day',
    ]) {
      const response = await call(ctx, 'GET', `/api/leaderboards?${query}`)
      expect(response.status, query).toBe(400)
      expect(await response.json()).toMatchObject({ error: { code: 'invalid_query' } })
    }
  })

  it('drops a deleted player from every table', async () => {
    await ctx.database.db.delete(user).where(eq(user.id, 'rival-0'))
    const body = await board('board=score.classic&period=all')
    expect(body.entries[0]).toMatchObject({ rank: 1, nickname: 'Rival 1' })
  })

  it('rate-limits each client address', async () => {
    const limited = await createTestContext({ rateLimits: { leaderboards: { limit: 2, windowMs: 60_000 } } })
    const get = (ip: string) => call(limited, 'GET', '/api/leaderboards?board=score.classic&period=all', { ip })
    expect((await get('10.9.9.1')).status).toBe(200)
    expect((await get('10.9.9.1')).status).toBe(200)
    const blocked = await get('10.9.9.1')
    expect(blocked.status).toBe(429)
    expect(blocked.headers.get('retry-after')).toBe('60')
    expect((await get('10.9.9.2')).status).toBe(200)
    await limited.close()
  })
})
