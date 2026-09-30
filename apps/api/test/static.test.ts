import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { CACHE_IMMUTABLE, CACHE_REVALIDATE, CACHE_SHORT } from '../src/static/site'
import { SITE_SECURITY_HEADERS } from '../src/static/security-headers'
import { createTestContext, type TestContext } from './helpers/context'

let ctx: TestContext
let site: string
let outside: string
const SCRIPT = `console.info(${JSON.stringify('orb '.repeat(1000))})`

beforeAll(async () => {
  site = mkdtempSync(join(tmpdir(), 'api-static-'))
  mkdirSync(join(site, 'assets'))
  writeFileSync(join(site, 'index.html'), '<!doctype html><title>Trap The Orb</title><div id="root"></div>')
  writeFileSync(join(site, '404.html'), '<!doctype html><title>Page not found</title>')
  writeFileSync(join(site, 'robots.txt'), 'User-agent: *\n')
  writeFileSync(join(site, 'assets', 'index-abc123.js'), SCRIPT)
  outside = mkdtempSync(join(tmpdir(), 'api-outside-'))
  writeFileSync(join(outside, 'secret.txt'), 'not for the web')
  symlinkSync(join(outside, 'secret.txt'), join(site, 'assets', 'leak.txt'))
  ctx = await createTestContext({ env: { STATIC_DIR: site } })
})

afterAll(async () => {
  await ctx.close()
  rmSync(site, { recursive: true, force: true })
  rmSync(outside, { recursive: true, force: true })
})

const get = (path: string, headers: Record<string, string> = {}) => Promise.resolve(ctx.app.request(path, { headers }))

describe('static site (STATIC_DIR)', () => {
  it('serves the app shell at / with the site security headers and no-cache', async () => {
    const response = await get('/')
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toMatch(/^text\/html/)
    expect(response.headers.get('cache-control')).toBe(CACHE_REVALIDATE)
    for (const [name, value] of Object.entries(SITE_SECURITY_HEADERS)) expect(response.headers.get(name)).toBe(value)
    expect(await response.text()).toContain('<div id="root">')
  })

  it('falls back to index.html for the app routes', async () => {
    for (const path of ['/leaderboards', '/leaderboards/', '/profile', '/play/classic', '/play/daily/2026-09-24']) {
      const response = await get(path)
      expect(response.status, path).toBe(200)
      expect(await response.text()).toContain('<div id="root">')
    }
  })

  it('serves hashed assets as immutable and other files with a short cache', async () => {
    const asset = await get('/assets/index-abc123.js')
    expect(asset.status).toBe(200)
    expect(asset.headers.get('content-type')).toMatch(/javascript/)
    expect(asset.headers.get('cache-control')).toBe(CACHE_IMMUTABLE)
    expect(await asset.text()).toBe(SCRIPT)

    const robots = await get('/robots.txt')
    expect(robots.headers.get('cache-control')).toBe(CACHE_SHORT)
  })

  it('answers unknown paths with 404.html and a 404 status', async () => {
    for (const path of ['/nope', '/play', '/assets', '/assets/missing.js', '/%2e%2e/package.json', '/assets/..%2f404.html', '/assets/leak.txt']) {
      const response = await get(path)
      expect(response.status, path).toBe(404)
      expect(await response.text()).toContain('Page not found')
    }
  })

  it('supports HEAD, conditional requests and compression', async () => {
    const head = await ctx.app.request('/', { method: 'HEAD' })
    expect(head.status).toBe(200)
    expect(Number(head.headers.get('content-length'))).toBeGreaterThan(0)
    expect(await head.text()).toBe('')

    const first = await get('/assets/index-abc123.js')
    const etag = first.headers.get('etag') ?? ''
    expect(etag).toMatch(/^W\//)
    expect((await get('/assets/index-abc123.js', { 'if-none-match': etag })).status).toBe(304)

    const gzipped = await get('/assets/index-abc123.js', { 'accept-encoding': 'gzip' })
    expect(gzipped.headers.get('content-encoding')).toBe('gzip')
  })

  it('leaves the API alone', async () => {
    const health = await ctx.app.request('/api/health')
    expect(await health.json()).toEqual({ ok: true, db: true })
    const missing = await ctx.app.request('/api/nope')
    expect(missing.status).toBe(404)
    expect(await missing.json()).toMatchObject({ error: { code: 'not_found' } })
    const post = await ctx.app.request('/', { method: 'POST' })
    expect(post.status).toBe(404)
  })
})
