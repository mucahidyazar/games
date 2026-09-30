import { finishRunResponseSchema, meResponseSchema, startRunResponseSchema, type StartRunResponse } from '@games/contract'
import { dailySeed, TICKS_PER_SECOND } from '@games/trap-the-orb-engine'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { run } from '../src/db/schema'
import { createTestContext, type TestContext } from './helpers/context'
import { call, json, signUpPlayer, type Player } from './helpers/http'
import { playSession } from './helpers/play'

let ctx: TestContext

beforeAll(async () => {
  ctx = await createTestContext()
})

afterAll(async () => {
  await ctx.close()
})

async function startDaily(player: Player): Promise<StartRunResponse> {
  const response = await call(ctx, 'POST', '/api/runs', { player, body: { mode: 'daily', field: 'landscape' } })
  expect(response.status).toBe(201)
  return startRunResponseSchema.parse(await response.json())
}

/** Plays the day's challenge (same seed for everyone) and finishes it. */
async function playDaily(player: Player, started: StartRunResponse) {
  const { state, inputs } = playSession({ mode: 'daily', seed: started.seed, field: started.field, ticks: 3000 })
  ctx.clock.advance(Math.ceil(state.tick / TICKS_PER_SECOND + 1) * 1000)
  const response = await call(ctx, 'POST', `/api/runs/${started.runId}/finish`, {
    player,
    body: { endTick: state.tick, inputs, clientScore: state.score, clientLevel: state.level },
  })
  expect(response.status).toBe(200)
  return finishRunResponseSchema.parse(await response.json())
}

describe('Daily Challenge', () => {
  it('uses the shared seed of the UTC day and ranks only the first attempt', async () => {
    ctx.clock.set(new Date('2026-09-24T10:00:00Z'))
    const player = await signUpPlayer(ctx, 'Daily One')
    const meBefore = meResponseSchema.parse(await json(await call(ctx, 'GET', '/api/me', { player })))
    expect(meBefore.dailyPlayedToday).toBe(false)

    const first = await startDaily(player)
    expect(first).toMatchObject({ dailyDate: '2026-09-24', seed: dailySeed('2026-09-24'), ranked: true })
    const firstResult = await playDaily(player, first)
    expect(firstResult.ranked).toBe(true)
    expect(firstResult.records.map((update) => update.key)).toContain('score.daily:day:2026-09-24')

    const second = await startDaily(player)
    expect(second).toMatchObject({ seed: first.seed, ranked: false })
    const secondResult = await playDaily(player, second)
    expect(secondResult).toMatchObject({ ranked: false, newBadges: [], records: [] })

    const [row] = await ctx.database.db.select({ ranked: run.ranked }).from(run).where(eq(run.id, second.runId))
    expect(row?.ranked).toBe(false)
  })

  it('spends the day’s ranked attempt even when the first run is abandoned', async () => {
    ctx.clock.set(new Date('2026-09-27T08:00:00Z'))
    const player = await signUpPlayer(ctx, 'Quitter')

    const first = await startDaily(player)
    expect(first.ranked).toBe(true)
    const me = meResponseSchema.parse(await json(await call(ctx, 'GET', '/api/me', { player })))
    expect(me.dailyPlayedToday).toBe(true)

    // Starting again abandons the first run; the retry is practice, however well it goes.
    const retry = await startDaily(player)
    expect(retry.ranked).toBe(false)
    const [abandoned] = await ctx.database.db.select({ status: run.status }).from(run).where(eq(run.id, first.runId))
    expect(abandoned?.status).toBe('abandoned')
    const result = await playDaily(player, retry)
    expect(result).toMatchObject({ ranked: false, newBadges: [], records: [] })

    // The next day brings a fresh ranked attempt.
    ctx.clock.set(new Date('2026-09-28T08:00:00Z'))
    expect((await startDaily(player)).ranked).toBe(true)
  })

  it('files a run under the day it started, even when it ends after midnight', async () => {
    ctx.clock.set(new Date('2026-09-25T23:59:58Z'))
    const player = await signUpPlayer(ctx, 'Night Owl')
    const started = await startDaily(player)
    const result = await playDaily(player, started)
    expect(ctx.clock.now().toISOString().slice(0, 10)).toBe('2026-09-26')
    expect(result.records.map((update) => update.key)).toContain('score.daily:day:2026-09-25')
  })

  it('counts consecutive days and awards Devotee on the third', async () => {
    const player = await signUpPlayer(ctx, 'Devoted')
    const days = ['2026-10-01', '2026-10-02', '2026-10-03']
    const results = []
    for (const day of days) {
      ctx.clock.set(new Date(`${day}T09:00:00Z`))
      results.push(await playDaily(player, await startDaily(player)))
    }

    expect(results[0]?.newBadges.some((badge) => badge.id === 'devotee')).toBe(false)
    expect(results[1]?.newBadges.some((badge) => badge.id === 'devotee')).toBe(false)
    expect(results[2]?.newBadges).toContainEqual({ id: 'devotee', tier: 1 })

    const me = meResponseSchema.parse(await json(await call(ctx, 'GET', '/api/me', { player })))
    expect(me.dailyStreak).toBe(3)
    expect(me.badges).toContainEqual(expect.objectContaining({ id: 'devotee', tier: 1 }))
    // The badge board holds the sum of every tier the player owns, run badges included.
    const tierSum = me.badges.reduce((sum, earned) => sum + earned.tier, 0)
    expect(results[2]?.records).toContainEqual(expect.objectContaining({ board: 'stat.badges', key: 'stat.badges:all', value: tierSum }))
    expect(me.records).toContainEqual(expect.objectContaining({ board: 'stat.badges', value: tierSum }))

    // Yesterday still counts, so the streak survives until today's challenge is played…
    ctx.clock.set(new Date('2026-10-04T12:00:00Z'))
    expect(meResponseSchema.parse(await json(await call(ctx, 'GET', '/api/me', { player }))).dailyStreak).toBe(3)
    // …but a missed day ends it.
    ctx.clock.set(new Date('2026-10-05T12:00:00Z'))
    expect(meResponseSchema.parse(await json(await call(ctx, 'GET', '/api/me', { player }))).dailyStreak).toBe(0)
  })
})
