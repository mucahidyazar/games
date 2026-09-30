import { apiErrorSchema, meResponseSchema, updateProfileResponseSchema } from '@games/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestContext, type TestContext } from './helpers/context'
import { call, json, signIn } from './helpers/http'

let ctx: TestContext

beforeAll(async () => {
  ctx = await createTestContext({ rateLimits: { profile: { limit: 5, windowMs: 60_000 } } })
})

afterAll(async () => {
  await ctx.close()
})

const errorCode = async (response: Response): Promise<string> => apiErrorSchema.parse(await response.json()).error.code

describe('GET /api/me', () => {
  it('requires a session', async () => {
    const response = await call(ctx, 'GET', '/api/me')
    expect(response.status).toBe(401)
    expect(await errorCode(response)).toBe('unauthorized')
  })

  it('describes a new player: no profile, badges, records or streak yet', async () => {
    const player = await signIn(ctx, 'newbie@example.com')
    const response = await call(ctx, 'GET', '/api/me', { player })
    expect(response.status).toBe(200)
    const me = meResponseSchema.parse(await response.json())
    expect(me).toMatchObject({ profile: null, badges: [], records: [], dailyStreak: 0 })
    expect(me.user).toMatchObject({ email: 'newbie@example.com', name: '', image: null })
  })
})

describe('PUT /api/me/profile', () => {
  it('saves a trimmed nickname and shows it on /api/me', async () => {
    const player = await signIn(ctx, 'orbit@example.com')
    const saved = await call(ctx, 'PUT', '/api/me/profile', { player, body: { nickname: '  Orbit Queen ' } })
    expect(saved.status).toBe(200)
    expect(updateProfileResponseSchema.parse(await saved.json())).toEqual({ nickname: 'Orbit Queen' })

    const me = meResponseSchema.parse(await json(await call(ctx, 'GET', '/api/me', { player })))
    expect(me.profile).toEqual({ nickname: 'Orbit Queen' })
  })

  it('lets a player rename themselves, including a change of case only', async () => {
    const player = await signIn(ctx, 'rename@example.com')
    expect((await call(ctx, 'PUT', '/api/me/profile', { player, body: { nickname: 'Renamer' } })).status).toBe(200)
    expect((await call(ctx, 'PUT', '/api/me/profile', { player, body: { nickname: 'RENAMER' } })).status).toBe(200)
    const me = meResponseSchema.parse(await json(await call(ctx, 'GET', '/api/me', { player })))
    expect(me.profile?.nickname).toBe('RENAMER')
  })

  it('refuses a nickname someone else has, whatever its case', async () => {
    const owner = await signIn(ctx, 'owner@example.com')
    const rival = await signIn(ctx, 'rival@example.com')
    expect((await call(ctx, 'PUT', '/api/me/profile', { player: owner, body: { nickname: 'Taken Name' } })).status).toBe(200)

    const response = await call(ctx, 'PUT', '/api/me/profile', { player: rival, body: { nickname: 'tAKEN nAME' } })
    expect(response.status).toBe(409)
    expect(await errorCode(response)).toBe('nickname_taken')
  })

  it('refuses profanity, including leetspeak and separators', async () => {
    const player = await signIn(ctx, 'potty@example.com')
    for (const nickname of ['Sh1tLord', 'f.u.c.k', 'Big Ass', 'Şerefsiz']) {
      const response = await call(ctx, 'PUT', '/api/me/profile', { player, body: { nickname } })
      expect(response.status).toBe(422)
      expect(await errorCode(response)).toBe('nickname_not_allowed')
    }
  })

  it('validates the body: 422 for bad nicknames, 400 for broken JSON, 415 for non-JSON', async () => {
    const player = await signIn(ctx, 'strict@example.com')
    const tooShort = await call(ctx, 'PUT', '/api/me/profile', { player, body: { nickname: 'ab' } })
    expect(tooShort.status).toBe(422)
    expect(await errorCode(tooShort)).toBe('invalid_request')

    const broken = await call(ctx, 'PUT', '/api/me/profile', { player, headers: { 'content-type': 'application/json' }, body: undefined })
    expect(broken.status).toBe(400)
    expect(await errorCode(broken)).toBe('invalid_json')

    const form = await ctx.app.request('/api/me/profile', {
      method: 'PUT',
      headers: { cookie: player.cookie, origin: 'http://localhost:3101', 'x-forwarded-for': player.ip, 'content-type': 'text/plain' },
      body: 'nickname=Hello',
    })
    expect(form.status).toBe(415)
    expect(await errorCode(form)).toBe('unsupported_media_type')
  })

  it('requires the site origin (CSRF defence)', async () => {
    const player = await signIn(ctx, 'csrf@example.com')
    const foreign = await call(ctx, 'PUT', '/api/me/profile', { player, origin: 'https://evil.example', body: { nickname: 'Victim' } })
    expect(foreign.status).toBe(403)
    expect(await errorCode(foreign)).toBe('forbidden_origin')

    const missing = await call(ctx, 'PUT', '/api/me/profile', { player, origin: null, body: { nickname: 'Victim' } })
    expect(missing.status).toBe(403)
  })

  it('rate-limits nickname changes per player with Retry-After', async () => {
    const player = await signIn(ctx, 'fidget@example.com')
    for (let index = 0; index < 5; index++) {
      expect((await call(ctx, 'PUT', '/api/me/profile', { player, body: { nickname: `Fidget ${index}` } })).status).toBe(200)
    }
    const limited = await call(ctx, 'PUT', '/api/me/profile', { player, body: { nickname: 'Fidget 9' } })
    expect(limited.status).toBe(429)
    expect(await errorCode(limited)).toBe('rate_limited')
    expect(Number(limited.headers.get('retry-after'))).toBeGreaterThan(0)

    ctx.clock.advance(61_000)
    expect((await call(ctx, 'PUT', '/api/me/profile', { player, body: { nickname: 'Fidget 9' } })).status).toBe(200)
  })
})
