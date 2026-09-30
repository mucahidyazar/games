import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { emailOTP } from 'better-auth/plugins'
import { authSchema } from '../db/schema'
import type { Database } from '../db/types'
import type { AppConfig } from '../env'
import type { Logger, LogFields } from '../logger'
import { createLogSender, createResendSender, type OtpSender } from './email'

export const AUTH_BASE_PATH = '/api/auth'
export const COOKIE_PREFIX = 'tto'
/**
 * Better Auth reads the client address from this header only. The API sets it
 * itself on every auth request (dropping any value the client sent), so rate
 * limits and session records use the address resolved by client-ip.ts.
 */
export const CLIENT_IP_HEADER = 'x-client-ip'

export const OTP_LENGTH = 6
export const OTP_EXPIRES_IN_MINUTES = 10
const SECONDS_PER_MINUTE = 60
/** Strict limit on sending login codes, per client address. */
export const OTP_SEND_LIMIT = { window: 60, max: 3 } as const
const DEFAULT_AUTH_LIMIT = { window: 60, max: 100 } as const

/** Picks how login codes are delivered, or null when email sign-in is off. */
export function otpSenderFor(config: AppConfig, logger: Logger): OtpSender | null {
  if (config.resend) {
    return createResendSender({ ...config.resend, expiresInMinutes: OTP_EXPIRES_IN_MINUTES, logger })
  }
  return config.emailMode === 'log' ? createLogSender(logger) : null
}

/** Keeps Better Auth's log arguments that are safe to print: errors and primitives, never objects. */
function describeArgs(args: readonly unknown[]): LogFields | undefined {
  const details = args.flatMap((arg) => {
    if (arg instanceof Error) return [`${arg.name}: ${arg.message}`]
    if (typeof arg === 'string' || typeof arg === 'number' || typeof arg === 'boolean') return [String(arg)]
    return []
  })
  return details.length > 0 ? { details } : undefined
}

export interface CreateAuthOptions {
  readonly config: AppConfig
  readonly db: Database
  readonly logger: Logger
  /** Delivers login codes; null disables email sign-in. */
  readonly sendOtp: OtpSender | null
}

export function createAuth({ config, db, logger, sendOtp }: CreateAuthOptions) {
  const authLogger = logger.child({ scope: 'auth' })

  return betterAuth({
    appName: 'Trap The Orb',
    baseURL: config.authUrl,
    basePath: AUTH_BASE_PATH,
    secret: config.authSecret,
    database: drizzleAdapter(db, { provider: 'pg', schema: authSchema, transaction: true }),
    trustedOrigins: [...config.trustedOrigins],
    emailAndPassword: { enabled: false },
    socialProviders: config.google
      ? { google: { clientId: config.google.clientId, clientSecret: config.google.clientSecret, prompt: 'select_account' } }
      : {},
    account: {
      // The same verified email through Google or a login code is the same player.
      accountLinking: { enabled: true, trustedProviders: ['google'], updateUserInfoOnLink: true },
    },
    plugins: sendOtp
      ? [
          emailOTP({
            otpLength: OTP_LENGTH,
            expiresIn: OTP_EXPIRES_IN_MINUTES * SECONDS_PER_MINUTE,
            disableSignUp: false,
            storeOTP: 'hashed',
            sendVerificationOTP: ({ email, otp, type }) => sendOtp({ email, otp, type }),
          }),
        ]
      : [],
    rateLimit: {
      enabled: true,
      storage: 'memory',
      ...DEFAULT_AUTH_LIMIT,
      customRules: { '/email-otp/send-verification-otp': { ...OTP_SEND_LIMIT } },
    },
    advanced: {
      cookiePrefix: COOKIE_PREFIX,
      useSecureCookies: config.isProduction,
      defaultCookieAttributes: { httpOnly: true, sameSite: 'lax', secure: config.isProduction },
      ipAddress: { ipAddressHeaders: [CLIENT_IP_HEADER] },
      // Better Auth skips these checks under NODE_ENV=test unless told otherwise.
      disableOriginCheck: false,
      disableCSRFCheck: false,
    },
    telemetry: { enabled: false },
    logger: {
      disabled: config.logLevel === 'silent',
      level: config.logLevel === 'silent' ? 'error' : config.logLevel,
      log: (level, message, ...args) => authLogger[level](message, describeArgs(args)),
    },
  })
}

export type Auth = ReturnType<typeof createAuth>
