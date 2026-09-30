import { expect } from 'vitest'
import { SITE_ORIGIN, type TestContext } from './context'

/** A signed-in test player: the session cookie and the address it "connects" from. */
export interface Player {
  readonly email: string
  readonly cookie: string
  readonly ip: string
}

let addressCounter = 0

/** A unique client address per player, so Better Auth's per-IP limits never mix players up. */
export function nextIp(): string {
  addressCounter += 1
  return `10.${(addressCounter >> 16) & 255}.${(addressCounter >> 8) & 255}.${addressCounter & 255}`
}

export interface RequestOptions {
  readonly player?: Player | null
  readonly body?: unknown
  readonly origin?: string | null
  readonly ip?: string
  readonly headers?: Readonly<Record<string, string>>
}

/** Calls the app in-process the way the site does: same origin, JSON bodies, the session cookie. */
export function call(ctx: TestContext, method: string, path: string, options: RequestOptions = {}): Promise<Response> {
  const headers: Record<string, string> = { 'x-forwarded-for': options.ip ?? options.player?.ip ?? '10.255.255.254' }
  if (options.origin !== null) headers.origin = options.origin ?? SITE_ORIGIN
  if (options.player) headers.cookie = options.player.cookie
  if (options.body !== undefined) headers['content-type'] = 'application/json'
  const body = options.body === undefined ? undefined : JSON.stringify(options.body)
  return Promise.resolve(ctx.app.request(path, { method, headers: { ...headers, ...options.headers }, body }))
}

/** `name=value` pairs of every Set-Cookie header, ready for a Cookie header. */
export function cookieHeader(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(';')[0])
    .join('; ')
}

/** Signs in (creating the account if needed) through Better Auth's email OTP flow. */
export async function signIn(ctx: TestContext, email: string, ip: string = nextIp()): Promise<Player> {
  const sent = await call(ctx, 'POST', '/api/auth/email-otp/send-verification-otp', { ip, body: { email, type: 'sign-in' } })
  expect(sent.status).toBe(200)
  const otp = ctx.outbox.findLast((message) => message.email === email)?.otp
  expect(otp).toMatch(/^\d{6}$/)

  const signedIn = await call(ctx, 'POST', '/api/auth/sign-in/email-otp', { ip, body: { email, otp } })
  expect(signedIn.status).toBe(200)
  const cookie = cookieHeader(signedIn)
  expect(cookie).toContain('tto.session_token=')
  return { email, cookie, ip }
}

/** Signs in and picks a nickname, ready to start ranked runs. */
export async function signUpPlayer(ctx: TestContext, nickname: string): Promise<Player> {
  const player = await signIn(ctx, `${nickname.toLowerCase().replace(/[^a-z0-9]/g, '')}@example.com`)
  const saved = await call(ctx, 'PUT', '/api/me/profile', { player, body: { nickname } })
  expect(saved.status).toBe(200)
  return player
}

export async function json<T = unknown>(response: Response): Promise<T> {
  return (await response.json()) as T
}
