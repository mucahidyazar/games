import { trolleyTalliesResponseSchema, trolleyVoteResponseSchema, type TrolleyTalliesResponse } from '@games/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { trolleyVote } from '../src/db/schema'
import { createTestContext, type TestContext } from './helpers/context'
import { call, json, nextIp } from './helpers/http'

let ctx: TestContext

const voter = (n: number): string => `00000000-0000-4000-8000-${n.toString().padStart(12, '0')}`

async function vote(dilemmaId: string, choice: string, voterId: string, ip = nextIp()): Promise<Response> {
  return call(ctx, 'POST', '/api/trolley/votes', { body: { dilemmaId, choice, voterId }, ip })
}

async function tallies(): Promise<TrolleyTalliesResponse['tallies']> {
  const response = await call(ctx, 'GET', '/api/trolley/tallies')
  expect(response.status).toBe(200)
  return trolleyTalliesResponseSchema.parse(await response.json()).tallies
}

beforeAll(async () => {
  ctx = await createTestContext({ rateLimits: { trolleyVotes: { limit: 3, windowMs: 60_000 } } })
})

afterAll(async () => {
  await ctx.close()
})

describe('trolley votes', () => {
  it('starts with no tallies', async () => {
    expect(await tallies()).toEqual({})
  })

  it('counts anonymous votes per dilemma and returns the new tally', async () => {
    const first = await vote('classic-five-vs-one', 'pull', voter(1))
    expect(first.status).toBe(200)
    expect(trolleyVoteResponseSchema.parse(await first.json())).toEqual({ dilemmaId: 'classic-five-vs-one', tally: { pull: 1, stay: 0 } })

    await vote('classic-five-vs-one', 'stay', voter(2))
    await vote('classic-five-vs-one', 'pull', voter(3))
    await vote('cats-vs-dog', 'stay', voter(1))

    expect(await tallies()).toEqual({
      'classic-five-vs-one': { pull: 2, stay: 1 },
      'cats-vs-dog': { pull: 0, stay: 1 },
    })
  })

  it('counts votes on Philippa Foot’s cases alongside the absurd ones', async () => {
    const response = await vote('foot-judge', 'stay', voter(6))
    expect(trolleyVoteResponseSchema.parse(await response.json())).toEqual({ dilemmaId: 'foot-judge', tally: { pull: 0, stay: 1 } })
    expect((await tallies())['foot-judge']).toEqual({ pull: 0, stay: 1 })
  })

  it('lets a device change its mind without counting twice', async () => {
    const changed = await vote('classic-five-vs-one', 'stay', voter(1))
    expect(trolleyVoteResponseSchema.parse(await changed.json()).tally).toEqual({ pull: 1, stay: 2 })
    expect((await tallies())['classic-five-vs-one']).toEqual({ pull: 1, stay: 2 })
  })

  it('never reports votes on retired dilemmas', async () => {
    const now = ctx.clock.now()
    await ctx.database.db
      .insert(trolleyVote)
      .values({ dilemmaId: 'retired-dilemma', voterId: voter(9), choice: 'pull', createdAt: now, updatedAt: now })
    expect(Object.keys(await tallies())).not.toContain('retired-dilemma')
  })

  it('rejects malformed votes', async () => {
    expect((await vote('no-such-dilemma', 'pull', voter(4))).status).toBe(422)
    expect((await vote('cats-vs-dog', 'both', voter(4))).status).toBe(422)
    expect((await vote('cats-vs-dog', 'pull', 'not-a-uuid')).status).toBe(422)
    const text = await call(ctx, 'POST', '/api/trolley/votes', { body: undefined, ip: nextIp(), headers: { 'content-type': 'text/plain' } })
    expect(text.status).toBe(415)
  })

  it('refuses votes from other sites', async () => {
    const response = await call(ctx, 'POST', '/api/trolley/votes', {
      body: { dilemmaId: 'cats-vs-dog', choice: 'pull', voterId: voter(5) },
      origin: 'https://evil.example',
    })
    expect(response.status).toBe(403)
  })

  it('limits votes per client address', async () => {
    const ip = nextIp()
    for (let n = 0; n < 3; n++) expect((await vote('footbridge', 'stay', voter(20 + n), ip)).status).toBe(200)
    const limited = await vote('footbridge', 'stay', voter(30), ip)
    expect(limited.status).toBe(429)
    expect(limited.headers.get('retry-after')).toBeTruthy()
    expect(await json<{ error: { code: string } }>(limited)).toMatchObject({ error: { code: 'rate_limited' } })
  })

  it('is never cached', async () => {
    const response = await call(ctx, 'GET', '/api/trolley/tallies')
    expect(response.headers.get('cache-control')).toBe('no-store')
  })
})
