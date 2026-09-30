import { realpathSync, statSync } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { join, sep } from 'node:path'
import type { Context, MiddlewareHandler } from 'hono'
import { getMimeType } from 'hono/utils/mime'
import { SITE_SECURITY_HEADERS } from './security-headers'

/** Client-side routes of the single-page app; each serves index.html. `/x/*` means anything below /x/. */
export const SPA_ROUTES = [
  '/', '/profile', '/about',
  // The game on its own domain.
  '/leaderboards', '/play/*',
  // The same game mounted inside the portal. Keep in sync with the web game catalogue.
  '/trap-the-orb', '/trap-the-orb/leaderboards', '/trap-the-orb/play/*',
] as const

export const CACHE_IMMUTABLE = 'public, max-age=31536000, immutable'
export const CACHE_REVALIDATE = 'no-cache'
export const CACHE_SHORT = 'public, max-age=3600'

export type StaticRoute =
  | { readonly kind: 'file'; readonly path: string }
  | { readonly kind: 'app' }
  | { readonly kind: 'missing' }

export function isAppRoute(pathname: string): boolean {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  return SPA_ROUTES.some((route) => {
    if (!route.endsWith('/*')) return path === route
    const prefix = route.slice(0, -1)
    return path.startsWith(prefix) && path.length > prefix.length
  })
}

/** Decodes a URL path for the file system, or null when it tries to escape the root or is malformed. */
export function safeFilePath(pathname: string): string | null {
  try {
    const segments = pathname.split('/').slice(1).map((segment) => decodeURIComponent(segment))
    const unsafe = segments.some((segment) => segment === '.' || segment === '..' || /[\\/\0]/.test(segment))
    return unsafe ? null : `/${segments.join('/')}`
  } catch {
    return null
  }
}

/** Which response a GET for `pathname` gets: a real file, the app shell, or the 404 page. */
export function routeStatic(pathname: string, isFile: (path: string) => boolean): StaticRoute {
  const path = safeFilePath(pathname)
  if (path && path !== '/' && !path.endsWith('/') && isFile(path)) return { kind: 'file', path }
  return isAppRoute(pathname) ? { kind: 'app' } : { kind: 'missing' }
}

/** Hashed Vite assets never change; HTML must be revalidated; other files may be cached briefly. */
export function cacheControlFor(path: string): string {
  if (path.startsWith('/assets/')) return CACHE_IMMUTABLE
  return path.endsWith('.html') ? CACHE_REVALIDATE : CACHE_SHORT
}

function matchesEtag(header: string | undefined, etag: string): boolean {
  if (!header) return false
  const weak = (tag: string) => tag.trim().replace(/^W\//, '')
  return header.split(',').some((tag) => tag.trim() === '*' || weak(tag) === weak(etag))
}

async function sendFile(c: Context, root: string, path: string, status: 200 | 404): Promise<Response> {
  const absolute = join(root, path)
  const stats = await stat(absolute)
  const etag = `W/"${stats.size.toString(16)}-${Math.floor(stats.mtimeMs).toString(16)}"`
  const headers = {
    ...SITE_SECURITY_HEADERS,
    'Content-Type': getMimeType(absolute) ?? 'application/octet-stream',
    'Cache-Control': status === 404 ? CACHE_REVALIDATE : cacheControlFor(path),
    ETag: etag,
    'Last-Modified': stats.mtime.toUTCString(),
  }
  if (status === 200 && matchesEtag(c.req.header('if-none-match'), etag)) return c.body(null, 304, headers)
  if (c.req.method === 'HEAD') return c.body(null, status, { ...headers, 'Content-Length': String(stats.size) })
  return c.body(await readFile(absolute), status, headers)
}

/**
 * Serves the built web app (production): real files first, index.html for
 * the app's routes, and 404.html with a 404 status for everything else.
 * API paths are never handled here.
 */
export function staticSite(dir: string): MiddlewareHandler {
  const root = realpathSync(dir)
  // Resolves symlinks too, so a link inside the build can never expose files outside it.
  const isFile = (path: string): boolean => {
    try {
      const real = realpathSync(join(root, path))
      return real.startsWith(root + sep) && statSync(real).isFile()
    } catch {
      return false
    }
  }

  return async (c, next) => {
    const method = c.req.method
    if ((method !== 'GET' && method !== 'HEAD') || c.req.path === '/api' || c.req.path.startsWith('/api/')) return next()

    const route = routeStatic(c.req.path, isFile)
    if (route.kind === 'file') return sendFile(c, root, route.path, 200)
    if (route.kind === 'app') return sendFile(c, root, '/index.html', 200)
    if (isFile('/404.html')) return sendFile(c, root, '/404.html', 404)
    return c.text('Not found', 404, { ...SITE_SECURITY_HEADERS })
  }
}
