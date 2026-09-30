/** A signed-in player as the API sees them. */
export interface SessionUser {
  readonly id: string
  readonly email: string
  readonly name: string
  readonly image: string | null
}

/** Per-request values shared by middleware and handlers. */
export interface AppEnv {
  Variables: {
    /** Set by `loadSession`; null for anonymous requests. */
    user: SessionUser | null
    /** Best-known client address (see client-ip.ts); null when unknown. */
    clientIp: string | null
  }
}

export interface Clock {
  now(): Date
}

export const systemClock: Clock = { now: () => new Date() }
