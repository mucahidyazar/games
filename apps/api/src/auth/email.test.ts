import { describe, expect, it } from 'vitest'
import { createLogger } from '../logger'
import { createLogSender, createResendSender, maskEmail, OTP_EMAIL_SUBJECT, renderOtpEmail } from './email'

function capturingLogger() {
  const lines: Record<string, unknown>[] = []
  return { logger: createLogger({ level: 'debug', sink: (line) => lines.push(JSON.parse(line) as Record<string, unknown>) }), lines }
}

describe('renderOtpEmail', () => {
  it('renders a branded HTML and plain-text email around the code', () => {
    const email = renderOtpEmail('482913', 10)
    expect(email.subject).toBe('Your Trap The Orb code')
    expect(email.html).toContain('482913')
    expect(email.html).toContain('#0f2548')
    expect(email.html).toContain('#0aa39a')
    expect(email.html).toContain('letter-spacing:12px')
    expect(email.html).toContain('expires in 10 minutes')
    expect(email.html).toContain("If you didn't ask for this code, you can ignore this email.")
    expect(email.text).toContain('Your Trap The Orb code: 482913')
    expect(email.text).toContain('expires in 10 minutes')
  })

  it('escapes the code in HTML', () => {
    expect(renderOtpEmail('<b>', 10).html).toContain('&#60;b&#62;')
  })
})

describe('maskEmail', () => {
  it('keeps the first letter and the domain', () => {
    expect(maskEmail('mucahid@example.com')).toBe('m***@example.com')
    expect(maskEmail('broken')).toBe('b***@')
  })
})

describe('createResendSender', () => {
  it('posts the email to Resend with the API key as a bearer token', async () => {
    const calls: { url: string; init: RequestInit }[] = []
    const fakeFetch = (async (url: string, init: RequestInit) => {
      calls.push({ url, init })
      return new Response(JSON.stringify({ id: 'email_1' }), { status: 200 })
    }) as typeof fetch
    const send = createResendSender({ apiKey: 're_test', from: 'Trap The Orb <hello@mucahid.dev>', expiresInMinutes: 10, logger: capturingLogger().logger, fetch: fakeFetch })

    await send({ email: 'player@example.com', otp: '123456', type: 'sign-in' })

    expect(calls[0]?.url).toBe('https://api.resend.com/emails')
    expect(calls[0]?.init.headers).toMatchObject({ Authorization: 'Bearer re_test', 'Content-Type': 'application/json' })
    const body = JSON.parse(String(calls[0]?.init.body)) as Record<string, unknown>
    expect(body).toMatchObject({ from: 'Trap The Orb <hello@mucahid.dev>', to: ['player@example.com'], subject: OTP_EMAIL_SUBJECT })
    expect(body.text).toContain('123456')
  })

  it('logs a rejection without the address or the key, then fails', async () => {
    const { logger, lines } = capturingLogger()
    const fakeFetch = (async () =>
      new Response('{"message":"The mucahid.dev domain is not verified for player@example.com"}', { status: 403 })) as unknown as typeof fetch
    const send = createResendSender({ apiKey: 're_secret', from: 'hello@mucahid.dev', expiresInMinutes: 10, logger, fetch: fakeFetch })

    await expect(send({ email: 'player@example.com', otp: '123456', type: 'sign-in' })).rejects.toThrow('Resend responded with 403')
    const logged = JSON.stringify(lines)
    expect(logged).toContain('not verified')
    expect(logged).not.toContain('player@example.com')
    expect(logged).not.toContain('re_secret')
  })
})

describe('createLogSender', () => {
  it('logs the code with a masked address (development only)', async () => {
    const { logger, lines } = capturingLogger()
    await createLogSender(logger)({ email: 'dev@example.com', otp: '654321', type: 'sign-in' })
    expect(lines[0]).toMatchObject({ level: 'warn', to: 'd***@example.com', code: '654321' })
  })
})
