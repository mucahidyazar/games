import { randomBytes } from 'node:crypto'
import { existsSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import * as z from 'zod/mini'
import type { LogLevel } from './logger'
import { DEFAULT_PGLITE_DIR, ROOT_ENV_FILE } from './paths'

export type NodeEnv = 'development' | 'production' | 'test'

/** How login codes are delivered: Resend, the server log (development only) or not at all. */
export type EmailMode = 'resend' | 'log' | 'disabled'

export interface AppConfig {
  readonly nodeEnv: NodeEnv
  readonly isProduction: boolean
  /** Postgres connection string, or null for the embedded PGlite fallback (development only). */
  readonly databaseUrl: string | null
  /** PGlite data directory, or 'memory'. Only used when databaseUrl is null. */
  readonly pgliteDir: string
  readonly authSecret: string
  /** Public URL of the site the browser talks to; /api/auth lives under it. */
  readonly authUrl: string
  /** Origins allowed to call the API with cookies: the BETTER_AUTH_URL origin plus ALLOWED_ORIGINS. */
  readonly trustedOrigins: readonly string[]
  readonly google: { readonly clientId: string; readonly clientSecret: string } | null
  readonly resend: { readonly apiKey: string; readonly from: string } | null
  readonly emailMode: EmailMode
  readonly port: number
  /** Built web app to serve (production), or null to serve only the API. */
  readonly staticDir: string | null
  readonly migrateOnStart: boolean
  /** Reverse proxies in front of the API whose X-Forwarded-For entries are trusted; 0 = none. */
  readonly trustProxy: number
  readonly logLevel: LogLevel
}

export interface ParsedEnv {
  readonly config: AppConfig
  /** Non-fatal problems worth logging once at startup. Never contain secret values. */
  readonly warnings: readonly string[]
}

/** Thrown when the environment is invalid; lists every problem, never any value. */
export class ConfigError extends Error {
  readonly problems: readonly string[]

  constructor(problems: readonly string[]) {
    super(`Invalid environment configuration:\n${problems.map((problem) => `  - ${problem}`).join('\n')}`)
    this.name = 'ConfigError'
    this.problems = problems
  }
}

export const DEFAULT_AUTH_URL = 'http://localhost:3101'
export const DEFAULT_API_PORT = 3102
const MIN_SECRET_LENGTH = 32
const MAX_PORT = 65_535

const emailAddress = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/
const namedEmailAddress = /^[^<>]*<[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+>$/

const fieldsSchema = z.object({
  NODE_ENV: z.optional(z.enum(['development', 'production', 'test'])),
  DATABASE_URL: z.optional(
    z.string().check(z.regex(/^postgres(?:ql)?:\/\/\S+$/, 'must be a postgres:// or postgresql:// connection string')),
  ),
  PGLITE_DIR: z.optional(z.string()),
  BETTER_AUTH_SECRET: z.optional(z.string()),
  BETTER_AUTH_URL: z.optional(z.url({ protocol: /^https?$/, error: 'must be an absolute http(s) URL' })),
  GOOGLE_CLIENT_ID: z.optional(z.string()),
  GOOGLE_CLIENT_SECRET: z.optional(z.string()),
  RESEND_API_KEY: z.optional(z.string()),
  EMAIL_FROM: z.optional(
    z.string().check(
      z.refine((value) => emailAddress.test(value) || namedEmailAddress.test(value), {
        error: 'must look like "Trap The Orb <hello@example.com>" or hello@example.com',
      }),
    ),
  ),
  API_PORT: z.optional(z.string().check(z.regex(/^\d{1,5}$/, 'must be a port number'))),
  STATIC_DIR: z.optional(z.string()),
  ALLOWED_ORIGINS: z.optional(z.string()),
  DB_MIGRATE: z.optional(z.enum(['on', 'off'], { error: 'must be "on" or "off"' })),
  TRUST_PROXY: z.optional(z.string().check(z.regex(/^\d{1,2}$/, 'must be the number of proxies in front of the API'))),
  LOG_LEVEL: z.optional(z.enum(['debug', 'info', 'warn', 'error', 'silent'])),
})

type Fields = z.infer<typeof fieldsSchema>
type RawEnv = Readonly<Record<string, string | undefined>>

const FIELD_NAMES = Object.keys(fieldsSchema.shape) as (keyof Fields)[]
const LOWERCASE_FIELDS: ReadonlySet<string> = new Set(['DB_MIGRATE', 'LOG_LEVEL'])

/** Trims every known variable and treats empty values as unset (so `DATABASE_URL=` means PGlite). */
function normalize(raw: RawEnv): Record<string, string> {
  return Object.fromEntries(
    FIELD_NAMES.flatMap((name) => {
      const value = raw[name]?.trim()
      if (!value) return []
      return [[name, LOWERCASE_FIELDS.has(name) ? value.toLowerCase() : value]]
    }),
  )
}

function parseOrigins(list: string | undefined, problems: string[]): string[] {
  if (!list) return []
  return list
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .flatMap((entry) => {
      const url = URL.parse(entry)
      if (!url || (url.protocol !== 'http:' && url.protocol !== 'https:')) {
        problems.push('ALLOWED_ORIGINS: every entry must be an http(s) origin such as https://traptheorb.com')
        return []
      }
      return [url.origin]
    })
}

function resolveStaticDir(dir: string | undefined, cwd: string, problems: string[]): string | null {
  if (!dir) return null
  const absolute = resolve(cwd, dir)
  const index = join(absolute, 'index.html')
  if (!existsSync(index) || !statSync(index).isFile()) {
    problems.push('STATIC_DIR: must point to a built web app (a folder containing index.html)')
  }
  return absolute
}

interface Credentials<T> {
  readonly value: T | null
  readonly warning: string | null
}

function pair<T>(first: string | undefined, second: string | undefined, build: (a: string, b: string) => T, label: string): Credentials<T> {
  if (first && second) return { value: build(first, second), warning: null }
  if (first || second) return { value: null, warning: `${label} is disabled: set both of its variables` }
  return { value: null, warning: null }
}

function resolveSecret(fields: Fields, isProduction: boolean, generateSecret: () => string, problems: string[], warnings: string[]): string {
  const secret = fields.BETTER_AUTH_SECRET
  if (isProduction) {
    if (!secret) problems.push('BETTER_AUTH_SECRET is required when NODE_ENV=production')
    else if (secret.length < MIN_SECRET_LENGTH) problems.push(`BETTER_AUTH_SECRET must be at least ${MIN_SECRET_LENGTH} characters`)
    return secret ?? ''
  }
  if (!secret) {
    warnings.push('BETTER_AUTH_SECRET is not set: using an ephemeral development secret, so sessions end when the server restarts')
    return generateSecret()
  }
  if (secret.length < MIN_SECRET_LENGTH) warnings.push(`BETTER_AUTH_SECRET should be at least ${MIN_SECRET_LENGTH} characters`)
  return secret
}

export interface ParseEnvOptions {
  /** Base for relative STATIC_DIR / PGLITE_DIR paths. Defaults to process.cwd(). */
  readonly cwd?: string
  readonly generateSecret?: () => string
}

/** Validates the environment. Throws ConfigError listing every problem; never echoes values. */
export function parseEnv(raw: RawEnv, options: ParseEnvOptions = {}): ParsedEnv {
  const cwd = options.cwd ?? process.cwd()
  const generateSecret = options.generateSecret ?? (() => randomBytes(32).toString('base64url'))
  const parsed = fieldsSchema.safeParse(normalize(raw))
  if (!parsed.success) {
    throw new ConfigError(parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`))
  }

  const fields = parsed.data
  const problems: string[] = []
  const warnings: string[] = []
  const nodeEnv = fields.NODE_ENV ?? 'development'
  const isProduction = nodeEnv === 'production'

  if (isProduction && !fields.DATABASE_URL) problems.push('DATABASE_URL is required when NODE_ENV=production')
  const authSecret = resolveSecret(fields, isProduction, generateSecret, problems, warnings)

  const authUrl = (fields.BETTER_AUTH_URL ?? DEFAULT_AUTH_URL).replace(/\/+$/, '')
  if (isProduction && !authUrl.startsWith('https://')) {
    warnings.push('BETTER_AUTH_URL is not https: secure session cookies will not work over plain http')
  }
  const trustedOrigins = [...new Set([new URL(authUrl).origin, ...parseOrigins(fields.ALLOWED_ORIGINS, problems)])]

  const google = pair(fields.GOOGLE_CLIENT_ID, fields.GOOGLE_CLIENT_SECRET, (clientId, clientSecret) => ({ clientId, clientSecret }), 'Google sign-in')
  const resend = pair(fields.RESEND_API_KEY, fields.EMAIL_FROM, (apiKey, from) => ({ apiKey, from }), 'Email sign-in through Resend')
  for (const credentials of [google, resend]) if (credentials.warning) warnings.push(credentials.warning)

  const emailMode: EmailMode = resend.value ? 'resend' : isProduction ? 'disabled' : 'log'
  if (emailMode === 'log') warnings.push('Resend is not configured: login codes are written to the server log (development only)')
  if (emailMode === 'disabled') warnings.push('Email sign-in is disabled: set RESEND_API_KEY and EMAIL_FROM to enable it')

  const port = fields.API_PORT ? Number(fields.API_PORT) : DEFAULT_API_PORT
  if (port < 1 || port > MAX_PORT) problems.push(`API_PORT: must be between 1 and ${MAX_PORT}`)

  const staticDir = resolveStaticDir(fields.STATIC_DIR, cwd, problems)
  const pgliteDir = fields.PGLITE_DIR === 'memory' ? 'memory' : fields.PGLITE_DIR ? resolve(cwd, fields.PGLITE_DIR) : DEFAULT_PGLITE_DIR

  if (problems.length > 0) throw new ConfigError(problems)

  return {
    config: {
      nodeEnv,
      isProduction,
      databaseUrl: fields.DATABASE_URL ?? null,
      pgliteDir,
      authSecret,
      authUrl,
      trustedOrigins,
      google: google.value,
      resend: resend.value,
      emailMode,
      port,
      staticDir,
      migrateOnStart: fields.DB_MIGRATE !== 'off',
      trustProxy: fields.TRUST_PROXY ? Number(fields.TRUST_PROXY) : 0,
      logLevel: fields.LOG_LEVEL ?? 'info',
    },
    warnings,
  }
}

/**
 * Loads the repository .env into process.env when the file exists. Variables
 * that are already set — even to an empty string — are never overridden, so
 * `DATABASE_URL= pnpm --filter api dev` keeps using PGlite.
 */
export function loadEnvFile(path: string = ROOT_ENV_FILE): boolean {
  if (!existsSync(path)) return false
  process.loadEnvFile(path)
  return true
}

export interface LoadedConfig extends ParsedEnv {
  /** The .env file that was read, or null when there was none. */
  readonly envFile: string | null
}

/** Reads the .env file (if any) and validates process.env. */
export function loadConfig(envFile: string = ROOT_ENV_FILE): LoadedConfig {
  const loaded = loadEnvFile(envFile)
  return { ...parseEnv(process.env), envFile: loaded ? envFile : null }
}
