import type { GameId } from './games.ts'

/**
 * One codebase, several sites: the portal at games.mucahid.dev lists and
 * hosts every game, and a game can also live on its own domain with its own
 * name in the shared header. The site is chosen by the VITE_SITE build
 * setting or, when that is unset, by the hostname the page is served from.
 */

export type SiteId = 'portal' | 'traptheorb'

interface SiteBase {
  readonly id: SiteId
  /** Shown as the brand in the header and in page titles. */
  readonly name: string
  /** Canonical origin in production, e.g. https://games.mucahid.dev. */
  readonly url: string
  /** Hostnames (and their subdomains) that serve this site. */
  readonly hosts: readonly string[]
}

export interface PortalSite extends SiteBase {
  readonly kind: 'portal'
}

export interface GameSite extends SiteBase {
  readonly kind: 'game'
  readonly game: GameId
}

export type Site = PortalSite | GameSite

export const PORTAL: PortalSite = {
  id: 'portal',
  kind: 'portal',
  name: 'games.mucahid.dev',
  url: 'https://games.mucahid.dev',
  hosts: ['games.mucahid.dev'],
}

export const SITES: readonly Site[] = [
  PORTAL,
  {
    id: 'traptheorb',
    kind: 'game',
    game: 'trap-the-orb',
    name: 'Trap The Orb',
    url: 'https://traptheorb.com',
    hosts: ['traptheorb.com'],
  },
]

export function isSiteId(value: unknown): value is SiteId {
  return typeof value === 'string' && SITES.some((site) => site.id === value)
}

export function siteById(id: SiteId): Site {
  const site = SITES.find((candidate) => candidate.id === id)
  if (!site) throw new Error(`Unknown site: ${id}`)
  return site
}

const matchesHost = (hostname: string, host: string): boolean => hostname === host || hostname.endsWith(`.${host}`)

export interface ResolveSiteOptions {
  /** Where the page is served from, e.g. window.location.hostname. */
  readonly hostname?: string | null
  /** The VITE_SITE build setting; wins over the hostname. */
  readonly override?: string | null
}

/**
 * The site for a hostname: its production hosts, or `<site id>.localhost`
 * in development (browsers resolve *.localhost to the local machine, so
 * traptheorb.localhost:3101 previews the game's own site). Anything else,
 * including plain localhost, is the portal.
 */
export function resolveSite({ hostname, override }: ResolveSiteOptions = {}): Site {
  const selected = override?.trim()
  if (isSiteId(selected)) return siteById(selected)
  const host = (hostname ?? '').trim().toLowerCase().replace(/\.$/, '')
  if (host === '') return PORTAL
  return (
    SITES.find((site) => site.hosts.some((h) => matchesHost(host, h)) || matchesHost(host, `${site.id}.localhost`)) ??
    PORTAL
  )
}
