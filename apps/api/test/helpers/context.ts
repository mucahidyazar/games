import type { Hono } from 'hono'
import type { Auth } from '../../src/auth/auth'
import type { OtpMessage } from '../../src/auth/email'
import { createServices } from '../../src/bootstrap'
import type { DatabaseHandle } from '../../src/db/types'
import { type AppConfig, parseEnv } from '../../src/env'
import type { AppEnv, Clock } from '../../src/http/context'
import { silentLogger } from '../../src/logger'
import type { RateLimitSettings } from '../../src/security/rate-limit'
import { openTestDatabase } from './database'

export const SITE_ORIGIN = 'http://localhost:3101'
export const TEST_SECRET = 'test-secret-that-is-long-enough-for-better-auth-0123456789'

/** A settable clock: tests move time forward instead of waiting. */
export interface FakeClock extends Clock {
  set(date: Date): void
  advance(ms: number): void
}

export function createFakeClock(start: Date): FakeClock {
  let current = start.getTime()
  return {
    now: () => new Date(current),
    set: (date) => {
      current = date.getTime()
    },
    advance: (ms) => {
      current += ms
    },
  }
}

/** Test configuration built through the real parser, never from process.env (so never the real DATABASE_URL). */
export function testConfig(overrides: Readonly<Record<string, string>> = {}): AppConfig {
  return parseEnv({
    NODE_ENV: 'test',
    BETTER_AUTH_SECRET: TEST_SECRET,
    BETTER_AUTH_URL: SITE_ORIGIN,
    PGLITE_DIR: 'memory',
    // Each simulated player sends its own X-Forwarded-For address.
    TRUST_PROXY: '1',
    LOG_LEVEL: 'silent',
    ...overrides,
  }).config
}

export interface TestContext {
  readonly app: Hono<AppEnv>
  readonly auth: Auth
  readonly database: DatabaseHandle
  readonly clock: FakeClock
  readonly config: AppConfig
  /** Login codes "sent" so far, newest last. */
  readonly outbox: readonly OtpMessage[]
  close(): Promise<void>
}

export interface TestContextOptions {
  readonly env?: Readonly<Record<string, string>>
  readonly rateLimits?: Partial<RateLimitSettings>
  readonly now?: Date
}

export const DEFAULT_NOW = new Date('2026-09-24T10:00:00.000Z')

/** A fresh app on its own empty database (in-memory PGlite by default) with migrations applied. */
export async function createTestContext(options: TestContextOptions = {}): Promise<TestContext> {
  const config = testConfig(options.env)
  const clock = createFakeClock(options.now ?? DEFAULT_NOW)
  const outbox: OtpMessage[] = []
  const database = await openTestDatabase()
  const services = await createServices(config, silentLogger, {
    database,
    clock,
    rateLimits: options.rateLimits,
    sendOtp: async (message) => {
      outbox.push(message)
    },
  })
  return { ...services, clock, config, outbox, close: () => database.close() }
}
