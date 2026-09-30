import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { compress } from 'hono/compress'
import { cors } from 'hono/cors'
import { secureHeaders } from 'hono/secure-headers'
import { AUTH_BASE_PATH } from './auth/auth'
import { authRoutes } from './auth/routes'
import type { AppDeps } from './deps'
import { clientIp } from './http/client-ip'
import type { AppEnv } from './http/context'
import { createErrorHandler, HttpError, notFound } from './http/errors'
import { leaderboardRoutes } from './leaderboards/routes'
import { meRoutes } from './me/routes'
import { runRoutes } from './runs/routes'
import { requireTrustedOrigin } from './security/origin'
import { staticSite } from './static/site'
import { systemRoutes } from './system/routes'

const KIB = 1024
/** Recordings: up to 5000 inputs of ~40 bytes each. */
export const FINISH_BODY_LIMIT = 256 * KIB
export const DEFAULT_BODY_LIMIT = 32 * KIB
const CORS_MAX_AGE_SECONDS = 600

const isApiPath = (path: string): boolean => path === '/api' || path.startsWith('/api/')
const isFinishPath = (path: string): boolean => /^\/api\/runs\/[^/]+\/finish$/.test(path)

export function createApp(deps: AppDeps): Hono<AppEnv> {
  const app = new Hono<AppEnv>()
  app.onError(createErrorHandler(deps.logger))
  app.notFound(notFound)

  const payloadTooLarge = () => {
    throw new HttpError(413, 'payload_too_large', 'The request body is too large.')
  }
  const finishLimit = bodyLimit({ maxSize: FINISH_BODY_LIMIT, onError: payloadTooLarge })
  const defaultLimit = bodyLimit({ maxSize: DEFAULT_BODY_LIMIT, onError: payloadTooLarge })

  app.use('/api/*', clientIp(deps.config.trustProxy))
  app.use('/api/*', secureHeaders())
  app.use('/api/*', async (c, next) => {
    await next()
    // Responses depend on the session cookie; never let a cache keep them.
    if (!c.res.headers.has('Cache-Control')) c.header('Cache-Control', 'no-store')
  })
  // Only needed for cross-origin setups (ALLOWED_ORIGINS); same-origin requests ignore it.
  app.use(
    '/api/*',
    cors({
      origin: (origin) => (deps.config.trustedOrigins.includes(origin) ? origin : null),
      credentials: true,
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type'],
      maxAge: CORS_MAX_AGE_SECONDS,
    }),
  )
  app.use('/api/*', (c, next) => (isFinishPath(c.req.path) ? finishLimit(c, next) : defaultLimit(c, next)))
  app.use('/api/*', requireTrustedOrigin(deps.config.trustedOrigins, `${AUTH_BASE_PATH}/`))

  app.route(AUTH_BASE_PATH, authRoutes(deps.auth, { clock: deps.clock, otpEmailLimit: deps.rateLimits.otpEmail }))
  app.route('/api', systemRoutes(deps))
  app.route('/api', meRoutes(deps))
  app.route('/api', runRoutes(deps))
  app.route('/api', leaderboardRoutes(deps))

  if (deps.config.staticDir) {
    const compressSite = compress()
    app.use('*', (c, next) => (isApiPath(c.req.path) ? next() : compressSite(c, next)))
    app.use('*', staticSite(deps.config.staticDir))
  }

  return app
}
