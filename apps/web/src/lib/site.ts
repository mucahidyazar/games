import { site as currentSite } from '@/app/site'
import type { Site } from '@/sites/sites'

/**
 * Site-wide settings, parsed once from the public `VITE_*` build variables
 * on top of the site itself. Anything missing or malformed falls back to a
 * safe default so a bad value can never break the page or inject an
 * unexpected URL.
 */

export interface AdsenseConfig {
  /** Publisher id such as `ca-pub-1234567890123456`, or null when ads are off. */
  readonly client: string | null
  /** Numeric ad unit id for the sidebar slot. */
  readonly sidebarSlot: string | null
}

export interface SiteConfig {
  /** The site's name, e.g. "games.mucahid.dev" or "Trap The Orb". */
  readonly name: string
  /** Canonical base URL without a trailing slash: VITE_SITE_URL, or the site's own. */
  readonly url: string
  readonly contactEmail: string | null
  readonly adsense: AdsenseConfig
}

/** The raw variables `parseSiteEnv` reads; `import.meta.env` satisfies this shape. */
export interface SiteEnv {
  readonly VITE_SITE_URL?: string
  readonly VITE_CONTACT_EMAIL?: string
  readonly VITE_ADSENSE_CLIENT?: string
  readonly VITE_ADSENSE_SLOT_SIDEBAR?: string
}

const ADSENSE_CLIENT_PATTERN = /^ca-pub-\d{10,20}$/
const ADSENSE_SLOT_PATTERN = /^\d{5,20}$/
/** Deliberately strict: the address ends up in a `mailto:` link. */
const EMAIL_PATTERN = /^[\w.%+-]+@[a-z\d-]+(?:\.[a-z\d-]+)+$/i
const MAX_EMAIL_LENGTH = 254

/** Trimmed value, or null for missing and blank values. */
function present(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? ''
  return trimmed === '' ? null : trimmed
}

function matching(value: string | undefined, pattern: RegExp, maxLength = Infinity): string | null {
  const candidate = present(value)
  return candidate !== null && candidate.length <= maxLength && pattern.test(candidate) ? candidate : null
}

/** Absolute http(s) URL without query, fragment or trailing slash. */
function parseSiteUrl(value: string | undefined, fallback: string): string {
  const candidate = present(value)
  if (candidate === null) return fallback

  try {
    const url = new URL(candidate)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return fallback
    return `${url.origin}${url.pathname}`.replace(/\/+$/, '')
  } catch {
    // Not a parseable absolute URL (e.g. "traptheorb.com" or "/play").
    return fallback
  }
}

export function parseSiteEnv(env: SiteEnv, site: Site): SiteConfig {
  return Object.freeze({
    name: site.name,
    url: parseSiteUrl(env.VITE_SITE_URL, site.url),
    contactEmail: matching(env.VITE_CONTACT_EMAIL, EMAIL_PATTERN, MAX_EMAIL_LENGTH),
    adsense: Object.freeze({
      client: matching(env.VITE_ADSENSE_CLIENT, ADSENSE_CLIENT_PATTERN),
      sidebarSlot: matching(env.VITE_ADSENSE_SLOT_SIDEBAR, ADSENSE_SLOT_PATTERN),
    }),
  })
}

export const siteConfig: SiteConfig = parseSiteEnv(import.meta.env, currentSite)
