import { updateProfileRequestSchema, utcDateKey, type MeResponse, type UpdateProfileResponse } from '@games/contract'
import { Hono, type Context } from 'hono'
import { deleteCookie } from 'hono/cookie'
import type { Auth } from '../auth/auth'
import { currentUser, loadSession, requireUser } from '../auth/session'
import type { AppDeps } from '../deps'
import { readJson } from '../http/body'
import type { AppEnv } from '../http/context'
import { HttpError } from '../http/errors'
import { isNicknameAllowed } from '../profile/profanity'
import { findNickname, saveNickname } from '../profile/repository'
import { hasRankedDailyAttempt, rankedDailyDays } from '../runs/repository'
import { createRateLimiter, rateLimit } from '../security/rate-limit'
import { deleteUser, listBadges, listRecords } from './repository'
import { dailyStreak } from './streak'

/** Expires every Better Auth cookie, with the same name, path and attributes it was set with. */
async function clearAuthCookies(c: Context<AppEnv>, auth: Auth): Promise<void> {
  const { authCookies } = await auth.$context
  for (const cookie of [authCookies.sessionToken, authCookies.sessionData, authCookies.dontRememberToken, authCookies.accountData]) {
    const { path = '/', domain, secure, sameSite } = cookie.attributes
    deleteCookie(c, cookie.name, { path, domain, secure, sameSite, httpOnly: true })
  }
}

export function meRoutes(deps: AppDeps): Hono<AppEnv> {
  const { auth, clock } = deps
  const db = deps.database.db
  const routes = new Hono<AppEnv>()
  const session = loadSession(auth)
  const profileLimit = rateLimit(createRateLimiter(deps.rateLimits.profile), clock)

  routes.get('/me', session, requireUser, async (c) => {
    const user = currentUser(c)
    const today = utcDateKey(clock.now())
    const [nickname, badges, records, playedDays, dailyPlayedToday] = await Promise.all([
      findNickname(db, user.id),
      listBadges(db, user.id),
      listRecords(db, user.id),
      rankedDailyDays(db, user.id),
      hasRankedDailyAttempt(db, user.id, today),
    ])
    const body: MeResponse = {
      user,
      profile: nickname === null ? null : { nickname },
      badges,
      records,
      dailyStreak: dailyStreak(playedDays, today),
      dailyPlayedToday,
    }
    return c.json(body)
  })

  routes.put('/me/profile', session, requireUser, profileLimit, async (c) => {
    const user = currentUser(c)
    const { nickname } = await readJson(c, updateProfileRequestSchema)
    if (!isNicknameAllowed(nickname)) {
      throw new HttpError(422, 'nickname_not_allowed', 'That nickname is not allowed. Please pick another one.')
    }
    if ((await saveNickname(db, user.id, nickname, clock.now())) === 'taken') {
      throw new HttpError(409, 'nickname_taken', 'That nickname is taken. Please pick another one.')
    }
    const body: UpdateProfileResponse = { nickname }
    return c.json(body)
  })

  routes.delete('/me', session, requireUser, async (c) => {
    await deleteUser(db, currentUser(c).id)
    await clearAuthCookies(c, auth)
    return c.body(null, 204)
  })

  return routes
}
