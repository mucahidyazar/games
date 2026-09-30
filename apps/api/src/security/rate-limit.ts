import { isIP } from 'node:net'
import type { Context, MiddlewareHandler } from 'hono'
import type { AppEnv, Clock } from '../http/context'
import { HttpError } from '../http/errors'

export interface RateLimitRule {
  readonly limit: number
  readonly windowMs: number
}

export interface RateLimitDecision {
  readonly allowed: boolean
  /** Seconds until the next request would be allowed; 0 when allowed. */
  readonly retryAfterSeconds: number
}

export interface RateLimiter {
  consume(key: string, nowMs: number): RateLimitDecision
  /** Keys currently tracked (for tests and diagnostics). */
  size(): number
}

/** Drop idle keys every this many checks, so memory stays bounded. */
const SWEEP_EVERY = 1000
const MS_PER_SECOND = 1000

/**
 * In-memory sliding-window log: a key may make `limit` requests in any
 * `windowMs`. Per process — fine for a single API instance.
 */
export function createRateLimiter(rule: RateLimitRule): RateLimiter {
  const hits = new Map<string, readonly number[]>()
  let checks = 0

  const sweep = (nowMs: number): void => {
    for (const [key, times] of hits) {
      const last = times[times.length - 1]
      if (last === undefined || last <= nowMs - rule.windowMs) hits.delete(key)
    }
  }

  return {
    consume(key, nowMs) {
      checks += 1
      if (checks % SWEEP_EVERY === 0) sweep(nowMs)

      const recent = (hits.get(key) ?? []).filter((time) => time > nowMs - rule.windowMs)
      const oldest = recent[0]
      if (recent.length >= rule.limit && oldest !== undefined) {
        hits.set(key, recent)
        const retryAfterSeconds = Math.max(1, Math.ceil((oldest + rule.windowMs - nowMs) / MS_PER_SECOND))
        return { allowed: false, retryAfterSeconds }
      }
      hits.set(key, [...recent, nowMs])
      return { allowed: true, retryAfterSeconds: 0 }
    },
    size: () => hits.size,
  }
}

const IPV6_GROUPS = 8
const IPV6_NETWORK_GROUPS = 4

/** The eight 16-bit groups of an IPv6 address, with `::` expanded. */
function ipv6Groups(address: string): string[] {
  const [head = '', tail] = address.split('::')
  const left = head ? head.split(':') : []
  const right = tail ? tail.split(':') : []
  const zeros = tail === undefined ? [] : Array.from({ length: IPV6_GROUPS - left.length - right.length }, () => '0')
  return [...left, ...zeros, ...right]
}

/**
 * Rate-limit bucket of a client address. An IPv6 client usually controls a
 * whole /64, so its addresses share one bucket (as in Better Auth's limiter).
 */
export function addressBucket(address: string | null): string {
  if (!address) return 'unknown'
  if (isIP(address) !== 6) return address
  return `${ipv6Groups(address).slice(0, IPV6_NETWORK_GROUPS).join(':')}::/64`
}

/** Anonymous traffic is limited per client address. */
export function addressKey(c: Context<AppEnv>): string {
  return `ip:${addressBucket(c.get('clientIp'))}`
}

/** Signed-in players are limited per account, everyone else per client address. */
export function requesterKey(c: Context<AppEnv>): string {
  const user = c.get('user')
  return user ? `user:${user.id}` : addressKey(c)
}

export function rateLimit(limiter: RateLimiter, clock: Clock, key: (c: Context<AppEnv>) => string = requesterKey): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const decision = limiter.consume(key(c), clock.now().getTime())
    if (!decision.allowed) {
      throw new HttpError(429, 'rate_limited', `Too many requests. Try again in ${decision.retryAfterSeconds} s.`, {
        'Retry-After': String(decision.retryAfterSeconds),
      })
    }
    await next()
  }
}

export interface RateLimitSettings {
  readonly runStart: RateLimitRule
  readonly runFinish: RateLimitRule
  readonly profile: RateLimitRule
  readonly leaderboards: RateLimitRule
  /** Login-code emails per email address (Better Auth separately limits per client address). */
  readonly otpEmail: RateLimitRule
}

const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS

export const DEFAULT_RATE_LIMITS: RateLimitSettings = {
  runStart: { limit: 20, windowMs: MINUTE_MS },
  runFinish: { limit: 20, windowMs: MINUTE_MS },
  profile: { limit: 10, windowMs: MINUTE_MS },
  leaderboards: { limit: 120, windowMs: MINUTE_MS },
  otpEmail: { limit: 5, windowMs: HOUR_MS },
}
