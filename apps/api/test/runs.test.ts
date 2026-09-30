import {
  apiErrorSchema,
  finishRunResponseSchema,
  startRunResponseSchema,
  type FinishRunResponse,
  type StartRunResponse,
} from '@games/contract'
import { TICKS_PER_SECOND } from '@games/trap-the-orb-engine'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { run } from '../src/db/schema'
import { MAX_RUN_SECONDS, RUN_EXPIRY_MARGIN_SECONDS } from '../src/runs/timing'
import { createTestContext, type TestContext } from './helpers/context'
import { call, signIn, signUpPlayer, type Player } from './helpers/http'
import { playSession, type PlayedSession } from './helpers/play'

let ctx: TestContext
let alice: Player
let bob: Player

beforeAll(async () => {
  ctx = await createTestContext()
  alice = await signUpPlayer(ctx, 'Alice')
  bob = await signUpPlayer(ctx, 'Bob')
})

afterAll(async () => {
  await ctx.close()
})

const errorCode = async (response: Response): Promise<string> => apiErrorSchema.parse(await response.json()).error.code

async function startRun(player: Player, mode = 'classic', field = 'landscape'): Promise<StartRunResponse> {
  const response = await call(ctx, 'POST', '/api/runs', { player, body: { mode, field } })
  expect(response.status).toBe(201)
  return startRunResponseSchema.parse(await response.json())
}

/** Plays the run locally with the server's seed, the way the browser would. */
function play(started: StartRunResponse, ticks = 3000): PlayedSession {
  return playSession({ mode: started.mode, seed: started.seed, field: started.field, ticks })
}

/** Lets as much wall-clock time pass as the recording covers, so it is plausible. */
function waitFor({ state }: PlayedSession): void {
  ctx.clock.advance(Math.ceil(state.tick / TICKS_PER_SECOND + 1) * 1000)
}

function finishBody({ state, inputs }: PlayedSession, claims: { clientScore?: number; clientLevel?: number } = {}) {
  return { endTick: state.tick, inputs, clientScore: claims.clientScore ?? state.score, clientLevel: claims.clientLevel ?? state.level }
}

async function finish(player: Player, runId: string, body: unknown): Promise<Response> {
  return call(ctx, 'POST', `/api/runs/${runId}/finish`, { player, body })
}

async function runRow(runId: string) {
  const [row] = await ctx.database.db.select().from(run).where(eq(run.id, runId))
  return row
}

describe('POST /api/runs', () => {
  it('requires a session', async () => {
    const response = await call(ctx, 'POST', '/api/runs', { body: { mode: 'classic', field: 'landscape' } })
    expect(response.status).toBe(401)
  })

  it('requires a nickname first', async () => {
    const anonymous = await signIn(ctx, 'nameless@example.com')
    const response = await call(ctx, 'POST', '/api/runs', { player: anonymous, body: { mode: 'classic', field: 'landscape' } })
    expect(response.status).toBe(409)
    expect(await errorCode(response)).toBe('nickname_required')
  })

  it('only starts ranked modes', async () => {
    const response = await call(ctx, 'POST', '/api/runs', { player: alice, body: { mode: 'zen', field: 'landscape' } })
    expect(response.status).toBe(422)
    expect(await errorCode(response)).toBe('invalid_request')
  })

  it('picks a random 32-bit seed on the server', async () => {
    const first = await startRun(alice)
    const second = await startRun(alice, 'hardcore', 'portrait')
    expect(first).toMatchObject({ mode: 'classic', field: 'landscape', dailyDate: null })
    expect(second).toMatchObject({ mode: 'hardcore', field: 'portrait', dailyDate: null })
    for (const { seed } of [first, second]) expect(seed >= 0 && seed <= 0xffffffff).toBe(true)
    expect(first.runId).not.toBe(second.runId)
  })

  it('abandons the run the player left open', async () => {
    const left = await startRun(alice)
    const session = play(left)
    await startRun(alice)
    waitFor(session)

    const response = await finish(alice, left.runId, finishBody(session))
    expect(response.status).toBe(409)
    expect(await errorCode(response)).toBe('run_not_active')
    expect((await runRow(left.runId))?.status).toBe('abandoned')
  })
})

describe('POST /api/runs/:id/finish', () => {
  it('replays the recording from the server seed and stores the authoritative result', async () => {
    const started = await startRun(bob)
    const session = play(started)
    waitFor(session)

    const response = await finish(bob, started.runId, finishBody(session))
    expect(response.status).toBe(200)
    const body: FinishRunResponse = finishRunResponseSchema.parse(await response.json())
    expect(body.ranked).toBe(true)
    expect(body.result).toMatchObject({ score: session.state.score, level: session.state.level, status: session.state.status })
    expect(body.result.stats).toEqual(session.state.stats)

    // Score tables always; record boards only for what this (random-seed) game achieved.
    const boards = body.records.map((update) => `${update.board}:${update.period}`)
    expect(boards.slice(0, 2)).toEqual(['score.classic:week', 'score.classic:all'])
    expect(boards.includes('stat.biggestCapture:all')).toBe(session.state.stats.biggestCapturePct > 0)
    expect(boards.includes('stat.tightestTrap:all')).toBe(session.state.stats.tightestTrapPct !== null)
    const allTime = body.records.find((update) => update.board === 'score.classic' && update.period === 'all')
    expect(allTime).toMatchObject({ key: 'score.classic:all', value: session.state.score, rank: 1, improved: true })

    expect(await runRow(started.runId)).toMatchObject({
      status: 'finished',
      score: session.state.score,
      level: session.state.level,
      inputCount: session.inputs.length,
      endTick: session.state.tick,
      mismatch: false,
    })
  })

  it("ignores the client's claimed score, keeping the replayed one and flagging the mismatch", async () => {
    const started = await startRun(alice)
    const session = play(started)
    waitFor(session)

    const response = await finish(alice, started.runId, finishBody(session, { clientScore: 999_999, clientLevel: 42 }))
    expect(response.status).toBe(200)
    const body = finishRunResponseSchema.parse(await response.json())
    expect(body.result.score).toBe(session.state.score)
    expect(body.result.level).toBe(session.state.level)
    expect(await runRow(started.runId)).toMatchObject({ clientScore: 999_999, clientLevel: 42, mismatch: true, score: session.state.score })
  })

  it('refuses to finish the same run twice', async () => {
    const started = await startRun(alice)
    const session = play(started)
    waitFor(session)
    expect((await finish(alice, started.runId, finishBody(session))).status).toBe(200)

    const again = await finish(alice, started.runId, finishBody(session))
    expect(again.status).toBe(409)
    expect(await errorCode(again)).toBe('run_not_active')
  })

  it("hides other players' runs", async () => {
    const started = await startRun(alice)
    const session = play(started)
    waitFor(session)

    const response = await finish(bob, started.runId, finishBody(session))
    expect(response.status).toBe(404)
    expect(await errorCode(response)).toBe('run_not_found')
    expect((await finish(bob, 'not-a-uuid', finishBody(session))).status).toBe(404)
    expect((await finish(bob, '00000000-0000-4000-8000-000000000000', finishBody(session))).status).toBe(404)
  })

  it('rejects a recording longer than the time since the run started', async () => {
    const started = await startRun(alice)
    ctx.clock.advance(50_000)
    // One minute of game time after 50 s of wall-clock time: more than the 5 s grace allows.
    const oneMinute = 60 * TICKS_PER_SECOND
    const response = await finish(alice, started.runId, { endTick: oneMinute, inputs: [], clientScore: 0, clientLevel: 1 })
    expect(response.status).toBe(422)
    expect(await errorCode(response)).toBe('run_implausible')
    expect((await runRow(started.runId))?.status).toBe('active')
  })

  it('rejects malformed recordings', async () => {
    const started = await startRun(alice)
    const session = play(started)
    waitFor(session)
    const valid = finishBody(session)
    const bad = [
      { ...valid, inputs: [{ t: 10, c: 999, r: 10, o: 'v' }] },
      { ...valid, inputs: [{ t: 10, c: 10, r: 10, o: 'x' }] },
      { ...valid, endTick: -1 },
      { ...valid, clientScore: 'lots' },
      { inputs: valid.inputs },
    ]
    for (const body of bad) {
      const response = await finish(alice, started.runId, body)
      expect(response.status).toBe(422)
      expect(await errorCode(response)).toBe('invalid_request')
    }
  })

  it('rejects recordings the engine cannot replay', async () => {
    const started = await startRun(alice)
    const session = play(started)
    waitFor(session)
    const outOfOrder = [
      { t: 90, c: 50, r: 50, o: 'v' },
      { t: 30, c: 60, r: 50, o: 'v' },
    ]
    const response = await finish(alice, started.runId, { ...finishBody(session), inputs: outOfOrder })
    expect(response.status).toBe(422)
    expect(await errorCode(response)).toBe('invalid_run')

    // A portrait field is 150 columns wide, so column 200 is outside it.
    const portrait = await startRun(alice, 'classic', 'portrait')
    const wide = await finish(alice, portrait.runId, { endTick: 10, inputs: [{ t: 0, c: 200, r: 10, o: 'v' }], clientScore: 0, clientLevel: 1 })
    expect(await errorCode(wide)).toBe('invalid_run')
  })

  it('closes runs left open longer than any game can last', async () => {
    const started = await startRun(alice)
    const session = play(started)
    ctx.clock.advance((MAX_RUN_SECONDS + RUN_EXPIRY_MARGIN_SECONDS + 1) * 1000)

    const response = await finish(alice, started.runId, finishBody(session))
    expect(response.status).toBe(409)
    expect(await errorCode(response)).toBe('run_expired')
    expect((await runRow(started.runId))?.status).toBe('abandoned')
  })

  it('refuses recordings over the body limit', async () => {
    const started = await startRun(alice)
    const response = await ctx.app.request(`/api/runs/${started.runId}/finish`, {
      method: 'POST',
      headers: { cookie: alice.cookie, origin: 'http://localhost:3101', 'x-forwarded-for': alice.ip, 'content-type': 'application/json' },
      body: JSON.stringify({ endTick: 1, inputs: [], clientScore: 0, clientLevel: 1, padding: 'x'.repeat(300 * 1024) }),
    })
    expect(response.status).toBe(413)
  })
})
