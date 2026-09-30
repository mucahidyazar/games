import { describe, expect, it } from 'vitest'
import { testConfig } from '../../test/helpers/context'
import { createLogger, silentLogger } from '../logger'
import { otpSenderFor } from './auth'
import { withRetryAfter } from './routes'

describe('withRetryAfter', () => {
  it("copies Better Auth's X-Retry-After onto a 429 as the standard Retry-After", async () => {
    const limited = withRetryAfter(new Response('{"message":"Too many requests."}', { status: 429, headers: { 'X-Retry-After': '42' } }))
    expect(limited.status).toBe(429)
    expect(limited.headers.get('retry-after')).toBe('42')
    expect(await limited.text()).toBe('{"message":"Too many requests."}')
  })

  it('leaves every other response untouched', () => {
    const ok = new Response('ok', { status: 200, headers: { 'X-Retry-After': '1' } })
    expect(withRetryAfter(ok)).toBe(ok)
    const bare = new Response(null, { status: 429 })
    expect(withRetryAfter(bare)).toBe(bare)
  })
})

describe('otpSenderFor', () => {
  it('emails through Resend when configured, logs codes in development, and turns email off otherwise', async () => {
    expect(otpSenderFor(testConfig({ RESEND_API_KEY: 're_1', EMAIL_FROM: 'hello@mucahid.dev' }), silentLogger)).toBeTypeOf('function')
    expect(otpSenderFor(testConfig({ NODE_ENV: 'production', DATABASE_URL: 'postgres://x/y', BETTER_AUTH_URL: 'https://traptheorb.com' }), silentLogger)).toBeNull()

    const lines: string[] = []
    const logged = otpSenderFor(testConfig(), createLogger({ level: 'warn', sink: (line) => lines.push(line) }))
    await logged?.({ email: 'dev@example.com', otp: '111222', type: 'sign-in' })
    expect(lines.join('')).toContain('111222')
  })
})
