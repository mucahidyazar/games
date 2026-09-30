import { finishRunResponseSchema, startRunResponseSchema } from '@games/contract'
import { TICKS_PER_SECOND } from '@games/trap-the-orb-engine'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { account, badge, profile, record, run, session, user } from '../src/db/schema'
import { createTestContext, type TestContext } from './helpers/context'
import { call, json, signIn, signUpPlayer, type Player } from './helpers/http'
import { playSession } from './helpers/play'

let ctx: TestContext

beforeAll(async () => {
  ctx = await createTestContext()
})

afterAll(async () => {
  await ctx.close()
})

async function finishOneRun(player: Player): Promise<void> {
  const started = startRunResponseSchema.parse(await (await call(ctx, 'POST', '/api/runs', { player, body: { mode: 'daily', field: 'landscape' } })).json())
  const { state, inputs } = playSession({ mode: 'daily', seed: started.seed, ticks: 3000 })
  ctx.clock.advance(Math.ceil(state.tick / TICKS_PER_SECOND + 1) * 1000)
  const finished = await call(ctx, 'POST', `/api/runs/${started.runId}/finish`, {
    player,
    body: { endTick: state.tick, inputs, clientScore: state.score, clientLevel: state.level },
  })
  finishRunResponseSchema.parse(await finished.json())
}

async function rowsFor(userId: string): Promise<Record<string, number>> {
  const db = ctx.database.db
  const counts = await Promise.all([
    db.select().from(user).where(eq(user.id, userId)),
    db.select().from(session).where(eq(session.userId, userId)),
    db.select().from(account).where(eq(account.userId, userId)),
    db.select().from(profile).where(eq(profile.userId, userId)),
    db.select().from(run).where(eq(run.userId, userId)),
    db.select().from(record).where(eq(record.userId, userId)),
    db.select().from(badge).where(eq(badge.userId, userId)),
  ])
  const [users, sessions, accounts, profiles, runs, records, badges] = counts.map((rows) => rows.length)
  return { users: users ?? 0, sessions: sessions ?? 0, accounts: accounts ?? 0, profiles: profiles ?? 0, runs: runs ?? 0, records: records ?? 0, badges: badges ?? 0 }
}

describe('DELETE /api/me', () => {
  it('requires a session and the site origin', async () => {
    expect((await call(ctx, 'DELETE', '/api/me')).status).toBe(401)
    const player = await signIn(ctx, 'careful@example.com')
    expect((await call(ctx, 'DELETE', '/api/me', { player, origin: null })).status).toBe(403)
  })

  it('deletes the account with everything it owns and clears the session cookie', async () => {
    const player = await signUpPlayer(ctx, 'Short Lived')
    await finishOneRun(player)
    const { user: me } = await json<{ user: { id: string } }>(await call(ctx, 'GET', '/api/me', { player }))
    const before = await rowsFor(me.id)
    expect(before).toMatchObject({ users: 1, profiles: 1, runs: 1 })
    expect(before.sessions).toBeGreaterThan(0)
    expect(before.records).toBeGreaterThan(0)

    const response = await call(ctx, 'DELETE', '/api/me', { player })
    expect(response.status).toBe(204)
    const cleared = response.headers.getSetCookie().find((cookie) => cookie.startsWith('tto.session_token='))
    expect(cleared).toMatch(/Max-Age=0/i)
    expect(cleared).toMatch(/Path=\//i)

    expect(await rowsFor(me.id)).toEqual({ users: 0, sessions: 0, accounts: 0, profiles: 0, runs: 0, records: 0, badges: 0 })
    expect((await call(ctx, 'GET', '/api/me', { player })).status).toBe(401)
  })

  it('frees the nickname for someone else', async () => {
    const first = await signUpPlayer(ctx, 'Reusable')
    expect((await call(ctx, 'DELETE', '/api/me', { player: first })).status).toBe(204)
    const second = await signIn(ctx, 'next@example.com')
    expect((await call(ctx, 'PUT', '/api/me/profile', { player: second, body: { nickname: 'Reusable' } })).status).toBe(200)
  })
})
