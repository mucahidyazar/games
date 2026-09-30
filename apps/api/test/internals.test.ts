import { meResponseSchema } from '@games/contract'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createServices } from '../src/bootstrap'
import { openDatabase } from '../src/db/client'
import { badge, profile } from '../src/db/schema'
import { createLogger, silentLogger } from '../src/logger'
import { saveNickname } from '../src/profile/repository'
import { createTestContext, SITE_ORIGIN, testConfig, type TestContext } from './helpers/context'
import { openTestDatabase } from './helpers/database'
import { call, json, signIn } from './helpers/http'
import { insertPlayer } from './helpers/seed'

let ctx: TestContext

beforeAll(async () => {
  ctx = await createTestContext()
})

afterAll(async () => {
  await ctx.close()
})

describe('openDatabase', () => {
  it('builds a postgres.js client for a DATABASE_URL without connecting until the first query', async () => {
    // An unreachable address that is never queried: construction and shutdown only.
    const database = await openDatabase({ url: 'postgres://nobody:nothing@127.0.0.1:9/none', pgliteDir: 'memory', logger: silentLogger })
    expect(database.driver).toBe('postgres')
    await database.close()
  })

  it('opens PGlite when no URL is configured', async () => {
    const database = await openDatabase({ url: null, pgliteDir: 'memory', logger: silentLogger })
    expect(database.driver).toBe('pglite')
    await database.close()
  })
})

describe('Better Auth logging', () => {
  it("routes Better Auth's messages through the API logger, keeping only safe arguments", async () => {
    const lines: Record<string, unknown>[] = []
    const logger = createLogger({ level: 'debug', sink: (line) => lines.push(JSON.parse(line) as Record<string, unknown>) })
    const database = await openTestDatabase()
    const services = await createServices(testConfig({ LOG_LEVEL: 'debug' }), logger, { database, sendOtp: async () => {} })

    await services.app.request('/api/auth/sign-out', {
      method: 'POST',
      headers: { origin: 'https://evil.example', cookie: 'tto.session_token=forged', 'content-type': 'application/json', 'x-forwarded-for': '10.1.1.1' },
      body: '{}',
    })
    const authLines = lines.filter((line) => line.scope === 'auth')
    expect(authLines.some((line) => String(line.msg).includes('Invalid origin'))).toBe(true)
    expect(authLines.some((line) => Array.isArray(line.details))).toBe(true)
    await database.close()
  })
})

describe('GET /api/me with retired data', () => {
  it('skips badge ids the contract no longer knows instead of failing', async () => {
    const player = await signIn(ctx, 'retired@example.com')
    const me = meResponseSchema.parse(await json(await call(ctx, 'GET', '/api/me', { player })))
    await ctx.database.db.insert(badge).values({ userId: me.user.id, badgeId: 'retiredBadge', tier: 2, earnedAt: new Date() })
    await ctx.database.db.insert(badge).values({ userId: me.user.id, badgeId: 'climber', tier: 1, earnedAt: new Date() })

    const after = meResponseSchema.parse(await json(await call(ctx, 'GET', '/api/me', { player, headers: { origin: SITE_ORIGIN } })))
    expect(after.badges.map((earned) => earned.id)).toEqual(['climber'])
  })
})

describe('saveNickname', () => {
  it('reports "taken" when two players race for the same name', async () => {
    const db = ctx.database.db
    await insertPlayer(db, 'racer-a', null)
    await insertPlayer(db, 'racer-b', null)
    const now = new Date()
    // Both checks run before either write, so the unique index decides.
    const results = await Promise.all([saveNickname(db, 'racer-a', 'Photo Finish', now), saveNickname(db, 'racer-b', 'photo finish', now)])
    expect(results.toSorted()).toEqual(['saved', 'taken'])
    const owners = await db.select().from(profile).where(eq(profile.nickname, 'Photo Finish'))
    expect(owners).toHaveLength(results[0] === 'saved' ? 1 : 0)
  })
})
