import type { Context, MiddlewareHandler } from 'hono'
import type { AppEnv, SessionUser } from '../http/context'
import { unauthorized } from '../http/errors'
import type { Auth } from './auth'

/**
 * Resolves the Better Auth session cookie to a player (or null). Session
 * refresh is left to /api/auth/get-session, which the site calls anyway, so
 * game requests stay read-only on the session table.
 */
export function loadSession(auth: Auth): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers, query: { disableRefresh: true } })
    const user: SessionUser | null = session
      ? { id: session.user.id, email: session.user.email, name: session.user.name, image: session.user.image ?? null }
      : null
    c.set('user', user)
    await next()
  }
}

/** 401 unless `loadSession` found a signed-in player. */
export const requireUser: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!c.get('user')) throw unauthorized()
  await next()
}

/** The signed-in player; only call after `requireUser`. */
export function currentUser(c: Context<AppEnv>): SessionUser {
  const user = c.get('user')
  if (!user) throw unauthorized()
  return user
}
