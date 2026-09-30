import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { SITE_SECURITY_HEADERS } from './security-headers'
import { CACHE_IMMUTABLE, CACHE_REVALIDATE, CACHE_SHORT, cacheControlFor, isAppRoute, routeStatic, safeFilePath, SPA_ROUTES } from './site'

const VERCEL_JSON = fileURLToPath(new URL('../../../web/vercel.json', import.meta.url))

describe('isAppRoute', () => {
  it('matches the client-side routes, with or without a trailing slash', () => {
    expect(SPA_ROUTES).toContain('/trap-the-orb')
    for (const path of ['/', '/leaderboards', '/leaderboards/', '/profile', '/about', '/play/classic', '/play/daily/2026-09-24', '/trap-the-orb', '/trap-the-orb/', '/trap-the-orb/play/classic', '/trap-the-orb/leaderboards']) {
      expect(isAppRoute(path), path).toBe(true)
    }
  })

  it('does not match anything else', () => {
    for (const path of ['/play', '/play/', '/players', '/leaderboards/week', '/profile/edit', '/index.htm', '/unknown-game', '/trap-the-orb/unknown', '/trap-the-orb/play']) {
      expect(isAppRoute(path), path).toBe(false)
    }
  })
})

describe('safeFilePath', () => {
  it('decodes ordinary paths', () => {
    expect(safeFilePath('/assets/a%20b.js')).toBe('/assets/a b.js')
  })

  it('refuses traversal, encoded separators, NUL bytes and malformed escapes', () => {
    for (const path of ['/../etc/passwd', '/assets/%2e%2e/x', '/assets/..%2fx', '/a%5cb', '/a%00b', '/%E0%A4%A']) {
      expect(safeFilePath(path), path).toBeNull()
    }
  })
})

describe('routeStatic', () => {
  const files = new Set(['/index.html', '/assets/app-1.js', '/robots.txt'])
  const isFile = (path: string) => files.has(path)

  it('serves existing files first', () => {
    expect(routeStatic('/assets/app-1.js', isFile)).toEqual({ kind: 'file', path: '/assets/app-1.js' })
    expect(routeStatic('/robots.txt', isFile)).toEqual({ kind: 'file', path: '/robots.txt' })
  })

  it('serves the app shell for app routes and the 404 page for the rest', () => {
    expect(routeStatic('/', isFile)).toEqual({ kind: 'app' })
    expect(routeStatic('/play/zen', isFile)).toEqual({ kind: 'app' })
    expect(routeStatic('/trap-the-orb/play/zen', isFile)).toEqual({ kind: 'app' })
    expect(routeStatic('/trap-the-orb/leaderboards', isFile)).toEqual({ kind: 'app' })
    expect(routeStatic('/assets/missing.js', isFile)).toEqual({ kind: 'missing' })
    expect(routeStatic('/../index.html', isFile)).toEqual({ kind: 'missing' })
  })
})

describe('cacheControlFor', () => {
  it('caches hashed assets forever, revalidates HTML and briefly caches the rest', () => {
    expect(cacheControlFor('/assets/index-abc.js')).toBe(CACHE_IMMUTABLE)
    expect(cacheControlFor('/index.html')).toBe(CACHE_REVALIDATE)
    expect(cacheControlFor('/favicon.svg')).toBe(CACHE_SHORT)
  })
})

describe('SITE_SECURITY_HEADERS', () => {
  it.skipIf(!existsSync(VERCEL_JSON))('matches apps/web/vercel.json exactly', () => {
    const vercel = JSON.parse(readFileSync(VERCEL_JSON, 'utf8')) as {
      headers: { source: string; headers: { key: string; value: string }[] }[]
    }
    const site = vercel.headers.find((rule) => rule.source === '/(.*)')
    const expected = Object.fromEntries((site?.headers ?? []).map(({ key, value }) => [key, value]))
    expect(SITE_SECURITY_HEADERS).toEqual(expected)
  })
})
