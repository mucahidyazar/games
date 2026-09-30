import { isGameMode, type GameMode } from '@games/trap-the-orb-engine'
import { isGameId, type GameId } from './games.ts'
import type { Site } from './sites.ts'

/** The app's pages. Everything else renders the not-found page. */
export type Route =
  | { readonly page: 'home' }
  | { readonly page: 'play'; readonly game: GameId; readonly mode: GameMode | null }
  | { readonly page: 'leaderboards'; readonly game: GameId }
  | { readonly page: 'profile' }
  | { readonly page: 'about' }
  | { readonly page: 'notFound' }

const NOT_FOUND: Route = { page: 'notFound' }

/** The pages of one game, relative to where the game is mounted. */
function parseGameRoute(path: string, game: GameId): Route | null {
  if (path === '/') return { page: 'play', game, mode: null }
  if (path === '/leaderboards') return { page: 'leaderboards', game }
  const play = /^\/play\/([A-Za-z]+)$/.exec(path)
  if (play) {
    const mode = play[1] ?? ''
    return isGameMode(mode) ? { page: 'play', game, mode } : null
  }
  return null
}

/**
 * Maps a pathname to a page. On a game's own site the game is the root; on
 * the portal it lives under `/<game id>`, and `/` is the home page.
 */
export function parseRoute(pathname: string, site: Site): Route {
  const path = pathname.replace(/\/+$/, '') || '/'
  if (path === '/profile') return { page: 'profile' }
  if (path === '/about') return { page: 'about' }
  if (site.kind === 'game') return parseGameRoute(path, site.game) ?? NOT_FOUND

  if (path === '/') return { page: 'home' }
  const [, first = '', ...rest] = path.split('/')
  if (!isGameId(first)) return NOT_FOUND
  return parseGameRoute(rest.length === 0 ? '/' : `/${rest.join('/')}`, first) ?? NOT_FOUND
}

/** The game a route belongs to, if any. */
export function routeGame(route: Route): GameId | null {
  return route.page === 'play' || route.page === 'leaderboards' ? route.game : null
}
