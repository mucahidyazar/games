import type { AddressInfo } from 'node:net'
import { serve, type ServerType } from '@hono/node-server'
import type { Hono } from 'hono'
import { createApp } from './app'
import { type Auth, createAuth, otpSenderFor } from './auth/auth'
import type { OtpSender } from './auth/email'
import { openDatabase } from './db/client'
import type { DatabaseHandle } from './db/types'
import type { AppConfig } from './env'
import { type AppEnv, type Clock, systemClock } from './http/context'
import type { Logger } from './logger'
import { DEFAULT_RATE_LIMITS, type RateLimitSettings } from './security/rate-limit'

export interface ServiceOverrides {
  /** Replaces the configured login-code delivery (tests capture codes this way). */
  readonly sendOtp?: OtpSender | null
  readonly clock?: Clock
  readonly rateLimits?: Partial<RateLimitSettings>
  /** An already-open database; otherwise one is opened from the config. */
  readonly database?: DatabaseHandle
}

export interface Services {
  readonly app: Hono<AppEnv>
  readonly auth: Auth
  readonly database: DatabaseHandle
}

/** Opens the database, applies migrations (unless DB_MIGRATE=off) and builds the app. */
export async function createServices(config: AppConfig, logger: Logger, overrides: ServiceOverrides = {}): Promise<Services> {
  const database = overrides.database ?? (await openDatabase({ url: config.databaseUrl, pgliteDir: config.pgliteDir, logger }))
  if (config.migrateOnStart) await database.migrate()

  const sendOtp = overrides.sendOtp === undefined ? otpSenderFor(config, logger) : overrides.sendOtp
  const auth = createAuth({ config, db: database.db, logger, sendOtp })
  const app = createApp({
    config,
    database,
    auth,
    logger,
    clock: overrides.clock ?? systemClock,
    rateLimits: { ...DEFAULT_RATE_LIMITS, ...overrides.rateLimits },
  })
  return { app, auth, database }
}

export interface RunningServer {
  readonly port: number
  readonly services: Services
  /** Stops accepting connections, lets in-flight requests finish (up to a timeout), then closes the database. */
  close(): Promise<void>
}

const SHUTDOWN_TIMEOUT_MS = 10_000

function closeServer(server: ServerType): Promise<void> {
  return new Promise((resolve, reject) => {
    const force = setTimeout(() => {
      if ('closeAllConnections' in server) server.closeAllConnections()
    }, SHUTDOWN_TIMEOUT_MS)
    force.unref()
    server.close((error) => {
      clearTimeout(force)
      if (error) reject(error)
      else resolve()
    })
  })
}

export async function startServer(config: AppConfig, logger: Logger, overrides: ServiceOverrides = {}): Promise<RunningServer> {
  const services = await createServices(config, logger, overrides)
  const { server, port } = await new Promise<{ server: ServerType; port: number }>((resolve) => {
    const server = serve({ fetch: services.app.fetch, port: config.port }, (info: AddressInfo) => resolve({ server, port: info.port }))
  })

  return {
    port,
    services,
    close: async () => {
      await closeServer(server)
      await services.database.close()
    },
  }
}
