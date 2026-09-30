import { createPaths } from '@/sites/paths'
import { resolveSite } from '@/sites/sites'

/**
 * The site this page belongs to, fixed for the page's lifetime: the VITE_SITE
 * build setting, or the hostname in any environment (see resolveSite).
 */
export const site = resolveSite({
  hostname: typeof window === 'undefined' ? null : window.location.hostname,
  override: import.meta.env.VITE_SITE,
})

export const paths = createPaths(site)
