import { useMemo, useSyncExternalStore } from 'react'
import { parseRoute as parseSiteRoute, type Route } from '@/sites/routes'
import { site } from './site'

export type { Route } from '@/sites/routes'

export const NAVIGATE_EVENT = 'app:navigate'

/** The page for a pathname on this site. */
export function parseRoute(pathname: string): Route {
  return parseSiteRoute(pathname, site)
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('popstate', onChange)
  window.addEventListener('hashchange', onChange)
  window.addEventListener(NAVIGATE_EVENT, onChange)
  return () => {
    window.removeEventListener('popstate', onChange)
    window.removeEventListener('hashchange', onChange)
    window.removeEventListener(NAVIGATE_EVENT, onChange)
  }
}

const getLocation = (): string => window.location.pathname + window.location.search + window.location.hash

/** Current path and query string, updated on navigation and history changes. */
export function useLocation(): string {
  return useSyncExternalStore(subscribe, getLocation, getLocation)
}

export function useRoute(): Route {
  const location = useLocation()
  const pathname = location.split(/[?#]/)[0] ?? '/'
  return useMemo(() => parseRoute(pathname), [pathname])
}

/**
 * Client-side navigation. Keep fragments shareable; useSectionScroll waits
 * for their target to mount, including lazy-loaded pages.
 */
export function navigate(to: string, { replace = false }: { readonly replace?: boolean } = {}): void {
  const url = new URL(to, window.location.href)
  const target = url.pathname + url.search + url.hash
  const changedPage = url.pathname !== window.location.pathname

  if (target !== getLocation()) {
    window.history[replace ? 'replaceState' : 'pushState'](null, '', target)
    window.dispatchEvent(new Event(NAVIGATE_EVENT))
  }
  if (!url.hash && !replace) {
    window.scrollTo({ top: 0 })
  }
  if (changedPage && !replace) document.getElementById('main')?.focus({ preventScroll: true })
}
