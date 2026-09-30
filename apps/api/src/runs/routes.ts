import { finishRunRequestSchema, startRunRequestSchema } from '@games/contract'
import { Hono } from 'hono'
import { currentUser, loadSession, requireUser } from '../auth/session'
import type { AppDeps } from '../deps'
import { readJson } from '../http/body'
import type { AppEnv } from '../http/context'
import { HttpError } from '../http/errors'
import { findNickname } from '../profile/repository'
import { createRateLimiter, rateLimit } from '../security/rate-limit'
import { finishRun, startRun } from './service'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function runRoutes(deps: AppDeps): Hono<AppEnv> {
  const { auth, clock, logger } = deps
  const db = deps.database.db
  const service = { db, clock, logger }
  const routes = new Hono<AppEnv>()
  const session = loadSession(auth)
  const startLimit = rateLimit(createRateLimiter(deps.rateLimits.runStart), clock)
  const finishLimit = rateLimit(createRateLimiter(deps.rateLimits.runFinish), clock)

  routes.post('/runs', session, requireUser, startLimit, async (c) => {
    const user = currentUser(c)
    if ((await findNickname(db, user.id)) === null) {
      throw new HttpError(409, 'nickname_required', 'Pick a nickname before playing ranked games.')
    }
    const request = await readJson(c, startRunRequestSchema)
    return c.json(await startRun(service, user.id, request), 201)
  })

  routes.post('/runs/:id/finish', session, requireUser, finishLimit, async (c) => {
    const user = currentUser(c)
    const runId = c.req.param('id')
    if (!UUID.test(runId)) throw new HttpError(404, 'run_not_found', 'This run does not exist.')
    const request = await readJson(c, finishRunRequestSchema)
    return c.json(await finishRun(service, user.id, runId, request))
  })

  return routes
}
