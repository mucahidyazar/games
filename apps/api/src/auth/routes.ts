import { Hono } from 'hono'
import type { AppEnv, Clock } from '../http/context'
import { createRateLimiter, type RateLimitRule } from '../security/rate-limit'
import { AUTH_BASE_PATH, type Auth, CLIENT_IP_HEADER } from './auth'

const SEND_OTP_PATH = `${AUTH_BASE_PATH}/email-otp/send-verification-otp`

/** Better Auth answers 429 with X-Retry-After; standard clients read Retry-After. */
export function withRetryAfter(response: Response): Response {
  const retryAfter = response.headers.get('x-retry-after')
  if (response.status !== 429 || !retryAfter || response.headers.has('retry-after')) return response
  const headers = new Headers(response.headers)
  headers.set('Retry-After', retryAfter)
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
}

/** The address a login code is requested for, normalised like Better Auth does; null when unreadable. */
async function requestedEmail(request: Request): Promise<string | null> {
  try {
    const body: unknown = await request.clone().json()
    if (typeof body === 'object' && body !== null && 'email' in body && typeof body.email === 'string') {
      return body.email.trim().toLowerCase()
    }
  } catch {
    // Malformed bodies are Better Auth's to reject.
  }
  return null
}

/** Same shape as Better Auth's own errors, so its client reports it the usual way. */
function tooManyCodes(retryAfterSeconds: number): Response {
  const body = { code: 'TOO_MANY_REQUESTS', message: 'Too many codes were requested for this email. Try again later.' }
  return Response.json(body, {
    status: 429,
    headers: { 'Retry-After': String(retryAfterSeconds), 'X-Retry-After': String(retryAfterSeconds) },
  })
}

export interface AuthRouteOptions {
  readonly clock: Clock
  /**
   * Login-code emails per address. Better Auth limits sending per client
   * address only, which rotating IPs could use to flood someone's inbox.
   */
  readonly otpEmailLimit: RateLimitRule
}

/** Mounts Better Auth under /api/auth, passing it the client address resolved by the API. */
export function authRoutes(auth: Auth, { clock, otpEmailLimit }: AuthRouteOptions): Hono<AppEnv> {
  const routes = new Hono<AppEnv>()
  const perEmail = createRateLimiter(otpEmailLimit)

  routes.on(['GET', 'POST'], '/*', async (c) => {
    const headers = new Headers(c.req.raw.headers)
    headers.delete(CLIENT_IP_HEADER)
    const ip = c.get('clientIp')
    if (ip) headers.set(CLIENT_IP_HEADER, ip)
    const request = new Request(c.req.raw, { headers, duplex: 'half' })

    if (request.method === 'POST' && c.req.path === SEND_OTP_PATH) {
      const email = await requestedEmail(request)
      const decision = email ? perEmail.consume(`email:${email}`, clock.now().getTime()) : null
      if (decision && !decision.allowed) return tooManyCodes(decision.retryAfterSeconds)
    }
    return withRetryAfter(await auth.handler(request))
  })

  return routes
}
