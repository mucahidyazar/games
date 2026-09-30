import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestContext, type TestContext } from './helpers/context'
import { call, cookieHeader, json, nextIp, signIn } from './helpers/http'

let ctx: TestContext

beforeAll(async () => {
  ctx = await createTestContext()
})

afterAll(async () => {
  await ctx.close()
})

interface SessionBody {
  user: { id: string; email: string; emailVerified: boolean; name: string }
}

describe('email OTP sign-in through Better Auth', () => {
  it('emails a 6-digit code, then signs the player in with an HttpOnly, SameSite=Lax session cookie', async () => {
    const ip = nextIp()
    const sent = await call(ctx, 'POST', '/api/auth/email-otp/send-verification-otp', {
      ip,
      body: { email: 'Ada@Example.com', type: 'sign-in' },
    })
    expect(sent.status).toBe(200)
    const message = ctx.outbox.at(-1)
    expect(message).toMatchObject({ email: 'ada@example.com', type: 'sign-in' })
    expect(message?.otp).toMatch(/^\d{6}$/)

    const signedIn = await call(ctx, 'POST', '/api/auth/sign-in/email-otp', {
      ip,
      body: { email: 'ada@example.com', otp: message?.otp },
    })
    expect(signedIn.status).toBe(200)
    const sessionCookie = signedIn.headers.getSetCookie().find((cookie) => cookie.startsWith('tto.session_token='))
    expect(sessionCookie).toBeDefined()
    expect(sessionCookie).toMatch(/HttpOnly/i)
    expect(sessionCookie).toMatch(/SameSite=Lax/i)
    expect(sessionCookie).not.toMatch(/Secure/i)

    const session = await call(ctx, 'GET', '/api/auth/get-session', { ip, player: { email: '', ip, cookie: cookieHeader(signedIn) } })
    const body = await json<SessionBody>(session)
    expect(body.user).toMatchObject({ email: 'ada@example.com', emailVerified: true })
  })

  it('signs the same email into the same account every time', async () => {
    const first = await signIn(ctx, 'same@example.com')
    const second = await signIn(ctx, 'same@example.com')
    const a = await json<SessionBody>(await call(ctx, 'GET', '/api/auth/get-session', { player: first }))
    const b = await json<SessionBody>(await call(ctx, 'GET', '/api/auth/get-session', { player: second }))
    expect(a.user.id).toBe(b.user.id)
  })

  it('rejects a wrong code', async () => {
    const ip = nextIp()
    await call(ctx, 'POST', '/api/auth/email-otp/send-verification-otp', { ip, body: { email: 'wrong@example.com', type: 'sign-in' } })
    const response = await call(ctx, 'POST', '/api/auth/sign-in/email-otp', { ip, body: { email: 'wrong@example.com', otp: '000000' } })
    expect(response.status).toBe(400)
  })

  it('limits login-code emails to 3 per minute per address, with Retry-After', async () => {
    const ip = nextIp()
    const send = () => call(ctx, 'POST', '/api/auth/email-otp/send-verification-otp', { ip, body: { email: 'spam@example.com', type: 'sign-in' } })
    for (let attempt = 0; attempt < 3; attempt++) expect((await send()).status).toBe(200)
    const limited = await send()
    expect(limited.status).toBe(429)
    expect(Number(limited.headers.get('retry-after'))).toBeGreaterThan(0)
  })

  it('limits login-code emails per address too, so rotating IPs cannot flood an inbox', async () => {
    const limited = await createTestContext({ rateLimits: { otpEmail: { limit: 2, windowMs: 3_600_000 } } })
    const send = (email: string) =>
      call(limited, 'POST', '/api/auth/email-otp/send-verification-otp', { ip: nextIp(), body: { email, type: 'sign-in' } })

    expect((await send('victim@example.com')).status).toBe(200)
    expect((await send('Victim@Example.com')).status).toBe(200)
    const blocked = await send('victim@example.com')
    expect(blocked.status).toBe(429)
    expect(Number(blocked.headers.get('retry-after'))).toBeGreaterThan(0)
    expect(await blocked.json()).toMatchObject({ code: 'TOO_MANY_REQUESTS' })
    expect(limited.outbox.filter((message) => message.email === 'victim@example.com')).toHaveLength(2)

    expect((await send('someone-else@example.com')).status).toBe(200)
    limited.clock.advance(3_600_001)
    expect((await send('victim@example.com')).status).toBe(200)
    await limited.close()
  })

  it('ignores a client-supplied X-Client-IP header', async () => {
    const ip = nextIp()
    const send = (spoofed: string) =>
      call(ctx, 'POST', '/api/auth/email-otp/send-verification-otp', {
        ip,
        headers: { 'x-client-ip': spoofed },
        body: { email: 'spoof@example.com', type: 'sign-in' },
      })
    const statuses = [await send('1.1.1.1'), await send('2.2.2.2'), await send('3.3.3.3'), await send('4.4.4.4')].map((r) => r.status)
    expect(statuses).toEqual([200, 200, 200, 429])
  })

  it('refuses cookie-bearing auth requests from a foreign origin', async () => {
    const player = await signIn(ctx, 'origin@example.com')
    const response = await call(ctx, 'POST', '/api/auth/sign-out', { player, origin: 'https://evil.example', body: {} })
    expect(response.status).toBe(403)
  })

  it('starts Google sign-in with account selection and the /api/auth/callback/google redirect URI', async () => {
    const withGoogle = await createTestContext({ env: { GOOGLE_CLIENT_ID: 'client-id.apps.googleusercontent.com', GOOGLE_CLIENT_SECRET: 'x' } })
    const response = await call(withGoogle, 'POST', '/api/auth/sign-in/social', { body: { provider: 'google', callbackURL: '/profile' } })
    expect(response.status).toBe(200)
    const { url, redirect } = await json<{ url: string; redirect: boolean }>(response)
    expect(redirect).toBe(true)
    const authorize = new URL(url)
    expect(authorize.hostname).toBe('accounts.google.com')
    expect(authorize.searchParams.get('prompt')).toBe('select_account')
    expect(authorize.searchParams.get('redirect_uri')).toBe('http://localhost:3101/api/auth/callback/google')
    expect(authorize.searchParams.get('client_id')).toBe('client-id.apps.googleusercontent.com')

    const foreign = await call(withGoogle, 'POST', '/api/auth/sign-in/social', { body: { provider: 'google', callbackURL: 'https://evil.example/steal' } })
    expect(foreign.status).toBe(403)
    await withGoogle.close()
  })

  it('signs out and forgets the session', async () => {
    const player = await signIn(ctx, 'leaver@example.com')
    const out = await call(ctx, 'POST', '/api/auth/sign-out', { player, body: {} })
    expect(out.status).toBe(200)
    const session = await call(ctx, 'GET', '/api/auth/get-session', { player })
    expect(await session.json()).toBeNull()
  })
})
