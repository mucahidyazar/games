import { apiErrorSchema, configResponseSchema } from '@games/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestContext, type TestContext } from './helpers/context'
import { call } from './helpers/http'

let ctx: TestContext

beforeAll(async () => {
  ctx = await createTestContext({ env: { ALLOWED_ORIGINS: 'https://play.example.com' } })
})

afterAll(async () => {
  await ctx.close()
})

describe('GET /api/health', () => {
  it('reports the API and database as up', async () => {
    const response = await call(ctx, 'GET', '/api/health')
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, db: true })
  })

  it('answers 503 when the database is unreachable', async () => {
    const broken = await createTestContext()
    await broken.database.close()
    const response = await call(broken, 'GET', '/api/health')
    expect(response.status).toBe(503)
    expect(apiErrorSchema.parse(await response.json()).error.code).toBe('db_unavailable')
  })
})

describe('GET /api/config', () => {
  it('offers email sign-in (logged codes in development) and hides Google when it is not configured', async () => {
    const body = configResponseSchema.parse(await (await call(ctx, 'GET', '/api/config')).json())
    expect(body).toEqual({ auth: { google: false, email: true } })
  })

  it('offers Google once both of its keys are set', async () => {
    const withGoogle = await createTestContext({ env: { GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: 'secret' } })
    const body = configResponseSchema.parse(await (await call(withGoogle, 'GET', '/api/config')).json())
    expect(body.auth.google).toBe(true)
    await withGoogle.close()
  })
})

describe('API responses', () => {
  it('carry security headers and are never cached', async () => {
    const response = await call(ctx, 'GET', '/api/config')
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    expect(response.headers.get('x-frame-options')).toBe('SAMEORIGIN')
    expect(response.headers.get('cache-control')).toBe('no-store')
  })

  it('answer unknown API paths with a JSON 404', async () => {
    const response = await call(ctx, 'GET', '/api/nope')
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: { code: 'not_found', message: 'Not found.' } })
  })

  it('allow credentialed CORS only for trusted origins', async () => {
    const allowed = await call(ctx, 'OPTIONS', '/api/runs', {
      origin: 'https://play.example.com',
      headers: { 'access-control-request-method': 'POST' },
    })
    expect(allowed.headers.get('access-control-allow-origin')).toBe('https://play.example.com')
    expect(allowed.headers.get('access-control-allow-credentials')).toBe('true')

    const denied = await call(ctx, 'OPTIONS', '/api/runs', {
      origin: 'https://evil.example',
      headers: { 'access-control-request-method': 'POST' },
    })
    expect(denied.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('reject oversized bodies with 413', async () => {
    const response = await call(ctx, 'PUT', '/api/me/profile', { body: { nickname: 'x'.repeat(64 * 1024) } })
    expect(response.status).toBe(413)
    expect(apiErrorSchema.parse(await response.json()).error.code).toBe('payload_too_large')
  })
})
