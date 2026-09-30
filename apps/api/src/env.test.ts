import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ConfigError, DEFAULT_API_PORT, loadConfig, loadEnvFile, parseEnv } from './env'
import { DEFAULT_PGLITE_DIR } from './paths'

const SECRET = 'a-production-grade-secret-with-plenty-of-entropy-42'
const PRODUCTION = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgres://games:pw@db.internal:5432/games',
  BETTER_AUTH_SECRET: SECRET,
  BETTER_AUTH_URL: 'https://traptheorb.com',
}

let scratch: string

beforeAll(() => {
  scratch = mkdtempSync(join(tmpdir(), 'api-env-'))
})

afterAll(() => {
  rmSync(scratch, { recursive: true, force: true })
})

function problemsOf(raw: Record<string, string>): readonly string[] {
  try {
    parseEnv(raw)
  } catch (error) {
    if (error instanceof ConfigError) return error.problems
    throw error
  }
  return []
}

describe('parseEnv in development', () => {
  it('falls back to PGlite, the default URL and port, and an ephemeral secret (with a warning)', () => {
    const { config, warnings } = parseEnv({ DATABASE_URL: '' }, { generateSecret: () => 'generated' })
    expect(config).toMatchObject({
      nodeEnv: 'development',
      isProduction: false,
      databaseUrl: null,
      pgliteDir: DEFAULT_PGLITE_DIR,
      authSecret: 'generated',
      authUrl: 'http://localhost:3101',
      trustedOrigins: ['http://localhost:3101'],
      google: null,
      resend: null,
      emailMode: 'log',
      port: DEFAULT_API_PORT,
      staticDir: null,
      migrateOnStart: true,
      trustProxy: 0,
      logLevel: 'info',
    })
    expect(warnings.some((warning) => warning.includes('ephemeral'))).toBe(true)
    expect(warnings.some((warning) => warning.includes('server log'))).toBe(true)
  })

  it('generates a real random secret by default', () => {
    const first = parseEnv({}).config.authSecret
    const second = parseEnv({}).config.authSecret
    expect(first).toHaveLength(43)
    expect(first).not.toBe(second)
  })

  it('warns about a short secret without failing', () => {
    const { config, warnings } = parseEnv({ BETTER_AUTH_SECRET: 'short' })
    expect(config.authSecret).toBe('short')
    expect(warnings.some((warning) => warning.includes('at least 32'))).toBe(true)
  })

  it('reads every optional setting', () => {
    mkdirSync(join(scratch, 'web'), { recursive: true })
    writeFileSync(join(scratch, 'web', 'index.html'), '<!doctype html>')
    const { config } = parseEnv(
      {
        NODE_ENV: 'test',
        BETTER_AUTH_URL: 'http://localhost:3101/',
        GOOGLE_CLIENT_ID: 'id',
        GOOGLE_CLIENT_SECRET: 'secret',
        RESEND_API_KEY: 're_123',
        EMAIL_FROM: 'Trap The Orb <hello@mucahid.dev>',
        API_PORT: '8080',
        STATIC_DIR: 'web',
        ALLOWED_ORIGINS: ' https://traptheorb.com, http://localhost:4173/ ,,',
        DB_MIGRATE: 'OFF',
        TRUST_PROXY: '2',
        LOG_LEVEL: 'debug',
        PGLITE_DIR: 'memory',
      },
      { cwd: scratch },
    )
    expect(config).toMatchObject({
      authUrl: 'http://localhost:3101',
      google: { clientId: 'id', clientSecret: 'secret' },
      resend: { apiKey: 're_123', from: 'Trap The Orb <hello@mucahid.dev>' },
      emailMode: 'resend',
      port: 8080,
      staticDir: join(scratch, 'web'),
      trustedOrigins: ['http://localhost:3101', 'https://traptheorb.com', 'http://localhost:4173'],
      migrateOnStart: false,
      trustProxy: 2,
      logLevel: 'debug',
      pgliteDir: 'memory',
    })
  })

  it('resolves a relative PGlite directory against the working directory', () => {
    expect(parseEnv({ PGLITE_DIR: 'db' }, { cwd: scratch }).config.pgliteDir).toBe(join(scratch, 'db'))
  })

  it('disables a sign-in method when only half of its keys are set', () => {
    const { config, warnings } = parseEnv({ GOOGLE_CLIENT_ID: 'id', RESEND_API_KEY: 're_1' })
    expect(config.google).toBeNull()
    expect(config.resend).toBeNull()
    expect(warnings.filter((warning) => warning.includes('set both'))).toHaveLength(2)
  })
})

describe('parseEnv in production', () => {
  it('accepts a complete configuration', () => {
    const { config } = parseEnv({ ...PRODUCTION, RESEND_API_KEY: 're_1', EMAIL_FROM: 'hello@mucahid.dev' })
    expect(config).toMatchObject({ isProduction: true, databaseUrl: PRODUCTION.DATABASE_URL, authSecret: SECRET, emailMode: 'resend' })
  })

  it('requires a database and a strong secret', () => {
    expect(problemsOf({ NODE_ENV: 'production' })).toEqual([
      'DATABASE_URL is required when NODE_ENV=production',
      'BETTER_AUTH_SECRET is required when NODE_ENV=production',
    ])
    expect(problemsOf({ ...PRODUCTION, BETTER_AUTH_SECRET: 'too-short' })).toEqual(['BETTER_AUTH_SECRET must be at least 32 characters'])
  })

  it('never falls back to logging login codes', () => {
    const { config, warnings } = parseEnv(PRODUCTION)
    expect(config.emailMode).toBe('disabled')
    expect(warnings.some((warning) => warning.includes('Email sign-in is disabled'))).toBe(true)
  })

  it('warns when the public URL is not https', () => {
    const { warnings } = parseEnv({ ...PRODUCTION, BETTER_AUTH_URL: 'http://localhost:3102' })
    expect(warnings.some((warning) => warning.includes('not https'))).toBe(true)
  })
})

describe('invalid values', () => {
  it('lists each problem by variable name, never by value', () => {
    const problems = problemsOf({
      DATABASE_URL: 'mysql://secret-host/db',
      BETTER_AUTH_URL: 'not a url',
      EMAIL_FROM: 'nobody',
      API_PORT: 'eighty',
      DB_MIGRATE: 'maybe',
      TRUST_PROXY: '-1',
      LOG_LEVEL: 'loud',
    })
    expect(problems.map((problem) => problem.split(':')[0])).toEqual([
      'DATABASE_URL',
      'BETTER_AUTH_URL',
      'EMAIL_FROM',
      'API_PORT',
      'DB_MIGRATE',
      'TRUST_PROXY',
      'LOG_LEVEL',
    ])
    expect(problems.join(' ')).not.toContain('secret-host')
  })

  it('checks ports, origins and the static folder', () => {
    expect(problemsOf({ API_PORT: '70000' })).toEqual(['API_PORT: must be between 1 and 65535'])
    expect(problemsOf({ ALLOWED_ORIGINS: 'ftp://files.example' })[0]).toMatch(/^ALLOWED_ORIGINS/)
    expect(problemsOf({ STATIC_DIR: join(scratch, 'missing') })[0]).toMatch(/^STATIC_DIR/)
  })

  it('formats every problem into one readable error', () => {
    const error = new ConfigError(['A is wrong', 'B is wrong'])
    expect(error.message).toBe('Invalid environment configuration:\n  - A is wrong\n  - B is wrong')
  })
})

describe('loadEnvFile / loadConfig', () => {
  it('loads a .env file without overriding variables that are already set, even empty ones', () => {
    const file = join(scratch, 'test.env')
    writeFileSync(file, 'API_TEST_FROM_FILE=file\nAPI_TEST_PRESET=file\nAPI_TEST_EMPTY=file\n')
    process.env.API_TEST_PRESET = 'env'
    process.env.API_TEST_EMPTY = ''
    try {
      expect(loadEnvFile(file)).toBe(true)
      expect(process.env.API_TEST_FROM_FILE).toBe('file')
      expect(process.env.API_TEST_PRESET).toBe('env')
      expect(process.env.API_TEST_EMPTY).toBe('')
    } finally {
      delete process.env.API_TEST_FROM_FILE
      delete process.env.API_TEST_PRESET
      delete process.env.API_TEST_EMPTY
    }
  })

  it('skips a missing file', () => {
    expect(loadEnvFile(join(scratch, 'absent.env'))).toBe(false)
  })

  it('validates process.env after loading the file', () => {
    const file = join(scratch, 'config.env')
    writeFileSync(file, 'API_PORT=4321\n')
    const saved = process.env.API_PORT
    delete process.env.API_PORT
    try {
      const loaded = loadConfig(file)
      expect(loaded.config.port).toBe(4321)
      expect(loaded.envFile).toBe(file)
      expect(loadConfig(join(scratch, 'absent.env')).envFile).toBeNull()
    } finally {
      if (saved === undefined) delete process.env.API_PORT
      else process.env.API_PORT = saved
    }
  })
})
