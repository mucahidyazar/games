import type { Logger } from '../logger'

export interface OtpMessage {
  readonly email: string
  readonly otp: string
  readonly type: string
}

/** Delivers a login code. Better Auth logs (and swallows) failures, so the endpoint never leaks them. */
export type OtpSender = (message: OtpMessage) => Promise<void>

export interface RenderedEmail {
  readonly subject: string
  readonly html: string
  readonly text: string
}

export const OTP_EMAIL_SUBJECT = 'Your Trap The Orb code'
const RESEND_ENDPOINT = 'https://api.resend.com/emails'
const RESEND_TIMEOUT_MS = 10_000
const MAX_ERROR_DETAIL = 300
const EMAIL_PATTERN = /[^\s"'<>@]+@[^\s"'<>]+/g

const NAVY = '#0f2548'
const TEAL = '#0aa39a'
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
const MONO = "'SFMono-Regular', Menlo, Consolas, 'Liberation Mono', monospace"

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`)

/** Branded HTML + plain-text email carrying a login code. */
export function renderOtpEmail(code: string, expiresInMinutes: number): RenderedEmail {
  const safeCode = escapeHtml(code)
  const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${OTP_EMAIL_SUBJECT}</title></head>
<body style="margin:0;padding:0;background:#f2f6f9;">
<div style="display:none;max-height:0;overflow:hidden;">Your code is ${safeCode}. It expires in ${expiresInMinutes} minutes.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f6f9;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;border-top:6px solid ${TEAL};">
<tr><td style="padding:32px 32px 0;font-family:${FONT};color:${NAVY};">
<p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${TEAL};">Trap The Orb</p>
<h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:${NAVY};">Your sign-in code</h1>
<p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:${NAVY};">Enter this code to sign in. It expires in ${expiresInMinutes} minutes.</p>
</td></tr>
<tr><td align="center" style="padding:0 32px;">
<div style="font-family:${MONO};font-size:36px;font-weight:700;letter-spacing:12px;color:${NAVY};background:#e7f6f5;border:2px solid ${TEAL};border-radius:12px;padding:16px 8px 16px 20px;">${safeCode}</div>
</td></tr>
<tr><td style="padding:24px 32px 32px;font-family:${FONT};font-size:13px;line-height:1.6;color:${NAVY};">
If you didn't ask for this code, you can ignore this email. Someone may have typed your address by mistake.
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`

  const text = [
    `Your Trap The Orb code: ${code}`,
    '',
    `Enter it to sign in. It expires in ${expiresInMinutes} minutes.`,
    '',
    "If you didn't ask for this code, you can ignore this email.",
  ].join('\n')

  return { subject: OTP_EMAIL_SUBJECT, html, text }
}

/** m***@example.com — enough to tell test accounts apart in development logs. */
export function maskEmail(email: string): string {
  const [local = '', domain = ''] = email.split('@')
  return `${local.slice(0, 1)}***@${domain}`
}

export interface ResendOptions {
  readonly apiKey: string
  readonly from: string
  readonly expiresInMinutes: number
  readonly logger: Logger
  readonly fetch?: typeof fetch
}

/** Sends login codes through Resend's REST API. */
export function createResendSender({ apiKey, from, expiresInMinutes, logger, fetch: send = fetch }: ResendOptions): OtpSender {
  return async ({ email, otp }) => {
    const { subject, html, text } = renderOtpEmail(otp, expiresInMinutes)
    const response = await send(RESEND_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [email], subject, html, text }),
      signal: AbortSignal.timeout(RESEND_TIMEOUT_MS),
    })
    if (!response.ok) {
      // Resend's error body names the problem (e.g. an unverified domain). Addresses are redacted.
      const body = await response.text().catch(() => '')
      const detail = body.replace(EMAIL_PATTERN, '[email]').slice(0, MAX_ERROR_DETAIL)
      logger.error('resend rejected a login email', { status: response.status, detail })
      throw new Error(`Resend responded with ${response.status}`)
    }
  }
}

/** Development only: prints the code instead of emailing it. */
export function createLogSender(logger: Logger): OtpSender {
  return async ({ email, otp }) => {
    logger.warn('login code (development only, not emailed)', { to: maskEmail(email), code: otp })
  }
}
