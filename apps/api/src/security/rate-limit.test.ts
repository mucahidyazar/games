import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import type { AppEnv } from '../http/context'
import { createErrorHandler } from '../http/errors'
import { silentLogger } from '../logger'
import { addressBucket, createRateLimiter, rateLimit, requesterKey } from './rate-limit'

describe('createRateLimiter', () => {
  it('allows `limit` requests per sliding window and says when to retry', () => {
    const limiter = createRateLimiter({ limit: 3, windowMs: 60_000 })
    expect(limiter.consume('a', 0).allowed).toBe(true)
    expect(limiter.consume('a', 10_000).allowed).toBe(true)
    expect(limiter.consume('a', 20_000).allowed).toBe(true)
    expect(limiter.consume('a', 30_000)).toEqual({ allowed: false, retryAfterSeconds: 30 })
    // The first request leaves the window at 60 s.
    expect(limiter.consume('a', 60_001).allowed).toBe(true)
    expect(limiter.consume('a', 60_002)).toEqual({ allowed: false, retryAfterSeconds: 10 })
  })

  it('keeps separate budgets per key', () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000 })
    expect(limiter.consume('a', 0).allowed).toBe(true)
    expect(limiter.consume('b', 0).allowed).toBe(true)
    expect(limiter.consume('a', 1).allowed).toBe(false)
  })

  it('never asks to wait less than a second', () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000 })
    limiter.consume('a', 0)
    expect(limiter.consume('a', 999)).toEqual({ allowed: false, retryAfterSeconds: 1 })
  })

  it('forgets idle keys so memory stays bounded', () => {
    const limiter = createRateLimiter({ limit: 5, windowMs: 1000 })
    for (let index = 0; index < 999; index++) limiter.consume(`key-${index}`, 0)
    expect(limiter.size()).toBe(999)
    limiter.consume('late', 5000)
    expect(limiter.size()).toBe(1)
  })
})

describe('rateLimit middleware', () => {
  const clock = { now: () => new Date(0) }

  function appWith(user: { id: string } | null, ip: string | null) {
    const app = new Hono<AppEnv>()
    app.onError(createErrorHandler(silentLogger))
    app.use('*', async (c, next) => {
      c.set('user', user ? { ...user, email: 'x@example.com', name: '', image: null } : null)
      c.set('clientIp', ip)
      await next()
    })
    app.get('/', rateLimit(createRateLimiter({ limit: 1, windowMs: 60_000 }), clock), (c) => c.text('ok'))
    return app
  }

  it('answers 429 with Retry-After once the budget is spent', async () => {
    const app = appWith(null, '10.0.0.1')
    expect((await app.request('/')).status).toBe(200)
    const limited = await app.request('/')
    expect(limited.status).toBe(429)
    expect(limited.headers.get('retry-after')).toBe('60')
    expect(await limited.json()).toMatchObject({ error: { code: 'rate_limited' } })
  })

  it('keys signed-in players by account and others by address', async () => {
    const context = (user: AppEnv['Variables']['user'], clientIp: string | null) =>
      ({ get: (name: 'user' | 'clientIp') => (name === 'user' ? user : clientIp) }) as unknown as Parameters<typeof requesterKey>[0]
    expect(requesterKey(context({ id: 'u1', email: '', name: '', image: null }, '1.2.3.4'))).toBe('user:u1')
    expect(requesterKey(context(null, '1.2.3.4'))).toBe('ip:1.2.3.4')
    expect(requesterKey(context(null, null))).toBe('ip:unknown')
  })
})

describe('addressBucket', () => {
  it('keeps IPv4 addresses as they are', () => {
    expect(addressBucket('203.0.113.7')).toBe('203.0.113.7')
    expect(addressBucket(null)).toBe('unknown')
  })

  it('groups IPv6 addresses by their /64 network', () => {
    expect(addressBucket('2001:db8:1:2:aaaa::1')).toBe('2001:db8:1:2::/64')
    expect(addressBucket('2001:db8:1:2:ffff:ffff:ffff:ffff')).toBe('2001:db8:1:2::/64')
    expect(addressBucket('2001:db8::1')).toBe('2001:db8:0:0::/64')
    expect(addressBucket('::1')).toBe('0:0:0:0::/64')
  })
})
