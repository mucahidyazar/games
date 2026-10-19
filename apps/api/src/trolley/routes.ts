import { trolleyVoteRequestSchema, type TrolleyTalliesResponse, type TrolleyVoteResponse } from '@games/contract'
import { Hono } from 'hono'
import type { AppDeps } from '../deps'
import { readJson } from '../http/body'
import type { AppEnv } from '../http/context'
import { addressKey, createRateLimiter, rateLimit } from '../security/rate-limit'
import { castVote, readTallies, readTally } from './repository'

/**
 * Absurd Trolley Problems' community votes, on the absurd dilemmas and on
 * Philippa Foot's cases. Anonymous by design: guests and signed-in players
 * vote the same way, with a random id their browser keeps.
 */
export function trolleyRoutes(deps: AppDeps): Hono<AppEnv> {
  const db = deps.database.db
  const routes = new Hono<AppEnv>()
  const talliesLimit = rateLimit(createRateLimiter(deps.rateLimits.trolleyTallies), deps.clock, addressKey)
  const voteLimit = rateLimit(createRateLimiter(deps.rateLimits.trolleyVotes), deps.clock, addressKey)

  routes.get('/trolley/tallies', talliesLimit, async (c) => {
    const body: TrolleyTalliesResponse = { tallies: await readTallies(db) }
    return c.json(body)
  })

  routes.post('/trolley/votes', voteLimit, async (c) => {
    const { dilemmaId, choice, voterId } = await readJson(c, trolleyVoteRequestSchema)
    await castVote(db, { dilemmaId, choice, voterId, at: deps.clock.now() })
    const body: TrolleyVoteResponse = { dilemmaId, tally: await readTally(db, dilemmaId) }
    return c.json(body)
  })

  return routes
}
