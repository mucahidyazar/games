import type { GameId } from './games.ts'
import { PORTAL, type Site } from './sites.ts'

/**
 * Where things live on the current site. On the portal every game sits under
 * its id (`/trap-the-orb/leaderboards`); on a game's own site the game is the
 * root (`/leaderboards`).
 */
export interface SitePaths {
  /** The site's front page: the portal home, or the game on a game site. */
  home(): string
  /** The game's page (its start menu). */
  game(id: GameId): string
  /** The game in a specific mode, or its page when `mode` is null. */
  play(id: GameId, mode?: string | null): string
  /** The game's leaderboards, with an optional query string (`?board=…`). */
  leaderboards(id: GameId, search?: string): string
  profile(): string
  about(): string
  /** The list of every game: a path on the portal, the portal's URL elsewhere. */
  allGames(): string
}

export function createPaths(site: Site): SitePaths {
  const base = (id: GameId): string => (site.kind === 'game' && site.game === id ? '' : `/${id}`)
  const game = (id: GameId): string => base(id) || '/'

  return {
    home: () => '/',
    game,
    play: (id, mode = null) => (mode ? `${base(id)}/play/${mode}` : game(id)),
    leaderboards: (id, search = '') => `${base(id)}/leaderboards${search}`,
    profile: () => '/profile',
    about: () => '/about',
    allGames: () => (site.kind === 'portal' ? '/' : PORTAL.url),
  }
}

/** True for links that leave the site (`https://…`), as opposed to in-app paths. */
export const isExternalHref = (href: string): boolean => /^[a-z]+:/i.test(href)
