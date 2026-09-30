import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import { createErrorHandler } from '../http/errors'
import { silentLogger } from '../logger'
import { isTrustedOrigin, requireTrustedOrigin } from './origin'

const TRUSTED = ['https://traptheorb.com', 'http://localhost:3101']

describe('isTrustedOrigin', () => {
  it('matches exact origins only', () => {
    expect(isTrustedOrigin('https://traptheorb.com', TRUSTED)).toBe(true)
    expect(isTrustedOrigin('https://traptheorb.com.evil.example', TRUSTED)).toBe(false)
    expect(isTrustedOrigin('http://traptheorb.com', TRUSTED)).toBe(false)
    expect(isTrustedOrigin('null', ['null'])).toBe(false)
    expect(isTrustedOrigin(undefined, TRUSTED)).toBe(false)
  })
})

describe('requireTrustedOrigin', () => {
  const app = new Hono()
  app.onError(createErrorHandler(silentLogger))
  app.use('*', requireTrustedOrigin(TRUSTED, '/api/auth/'))
  app.all('*', (c) => c.text('ok'))

  it('lets safe methods through without an origin', async () => {
    expect((await app.request('/api/me')).status).toBe(200)
    expect((await app.request('/api/me', { method: 'HEAD' })).status).toBe(200)
  })

  it('requires a trusted origin for state-changing requests', async () => {
    expect((await app.request('/api/runs', { method: 'POST', headers: { origin: 'https://traptheorb.com' } })).status).toBe(200)
    const foreign = await app.request('/api/runs', { method: 'POST', headers: { origin: 'https://evil.example' } })
    expect(foreign.status).toBe(403)
    expect(await foreign.json()).toMatchObject({ error: { code: 'forbidden_origin' } })
    expect((await app.request('/api/me', { method: 'DELETE' })).status).toBe(403)
  })

  it('leaves Better Auth routes to Better Auth', async () => {
    expect((await app.request('/api/auth/sign-out', { method: 'POST' })).status).toBe(200)
  })
})
