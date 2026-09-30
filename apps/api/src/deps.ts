import type { Auth } from './auth/auth'
import type { DatabaseHandle } from './db/types'
import type { AppConfig } from './env'
import type { Clock } from './http/context'
import type { Logger } from './logger'
import type { RateLimitSettings } from './security/rate-limit'

/** Everything the HTTP routes need, injected so tests can swap the clock, database and limits. */
export interface AppDeps {
  readonly config: AppConfig
  readonly database: DatabaseHandle
  readonly auth: Auth
  readonly logger: Logger
  readonly clock: Clock
  readonly rateLimits: RateLimitSettings
}
