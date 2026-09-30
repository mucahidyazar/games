import type { ConfigResponse } from '@games/contract'
import { Hono } from 'hono'
import type { AppDeps } from '../deps'
import type { AppEnv } from '../http/context'
import { HttpError } from '../http/errors'

/** Health check (for Docker and uptime monitors) and the public feature flags the site needs. */
export function systemRoutes({ config, database, logger }: AppDeps): Hono<AppEnv> {
  const routes = new Hono<AppEnv>()

  routes.get('/health', async (c) => {
    try {
      await database.ping()
    } catch (error) {
      logger.error('health check: database unreachable', { error })
      throw new HttpError(503, 'db_unavailable', 'The database is unreachable.')
    }
    return c.json({ ok: true, db: true })
  })

  const flags: ConfigResponse = { auth: { google: config.google !== null, email: config.emailMode !== 'disabled' } }
  routes.get('/config', (c) => c.json(flags))

  return routes
}
