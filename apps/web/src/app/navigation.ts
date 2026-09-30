import { gameById } from '@/sites/games'
import type { SitePaths } from '@/sites/paths'
import { routeGame, type Route } from '@/sites/routes'
import type { Site } from '@/sites/sites'

export const DIALOG_IDS = ['how-to-play', 'privacy', 'privacy-settings', 'account'] as const

export type DialogId = (typeof DIALOG_IDS)[number]

export interface NavItem {
  readonly label: string
  /** A page path, a page section (`/#games`), a dialog (`#privacy`) or an external URL. */
  readonly href: string
  readonly isActive: boolean
  readonly badge?: string
  /** Opens another site (the portal from a game's own domain). */
  readonly isExternal?: boolean
}

const item = (label: string, href: string, isActive = false): NavItem => ({ label, href, isActive })

/**
 * The header links for the page in view. The portal shows its own links until
 * a game is open, when the game's links take over; a game's own site always
 * shows the game's links plus a way back to every game.
 */
export function navItemsFor(site: Site, route: Route, paths: SitePaths): readonly NavItem[] {
  const gameId = site.kind === 'game' ? site.game : routeGame(route)

  if (!gameId) {
    return [item('Games', paths.home(), route.page === 'home'), item('Categories', '/#categories'), item('About', paths.about(), route.page === 'about')]
  }

  const game = gameById(gameId)
  const gameLinks = [
    item('Play', paths.game(gameId), route.page === 'play'),
    item('Leaderboards', paths.leaderboards(gameId), route.page === 'leaderboards'),
    item('How to play', '#how-to-play'),
  ]
  if (site.kind === 'portal') return [item('All games', paths.home()), ...gameLinks]
  return [
    ...gameLinks,
    item('About', paths.about(), route.page === 'about'),
    { label: 'More games', href: paths.allGames(), isActive: false, isExternal: true, badge: game.siteUrl ? undefined : 'New' },
  ]
}

export function isDialogId(value: string): value is DialogId {
  return (DIALOG_IDS as readonly string[]).includes(value)
}

/** The dialog addressed by a location hash such as `#privacy`, if any. */
export function dialogFromHash(hash: string): DialogId | null {
  const id = hash.replace(/^#/, '')
  return isDialogId(id) ? id : null
}

export interface FooterColumn {
  readonly title: string
  readonly links: readonly NavItem[]
}

/** The two link columns of the footer, for the page in view. */
export function footerColumnsFor(site: Site, route: Route, paths: SitePaths): readonly FooterColumn[] {
  const gameId = site.kind === 'game' ? site.game : routeGame(route)
  const play: NavItem[] = gameId
    ? [
        item('Play', paths.game(gameId), route.page === 'play'),
        item('Leaderboards', paths.leaderboards(gameId), route.page === 'leaderboards'),
        item('How to play', '#how-to-play'),
        { label: 'Mobile app', href: `${paths.game(gameId)}#apps`, isActive: false, badge: 'Soon' },
      ]
    : [item('All games', paths.home(), route.page === 'home'), item('Categories', '/#categories')]
  if (site.kind === 'portal' && gameId) play.unshift(item('All games', paths.home()))

  const about: NavItem[] = [item('About', paths.about(), route.page === 'about'), item('Privacy', '#privacy')]
  if (site.kind === 'game') about.push({ label: 'More games', href: paths.allGames(), isActive: false, isExternal: true })
  about.push({ label: 'mucahid.dev', href: 'https://mucahid.dev', isActive: false, isExternal: true })

  return [
    { title: 'Play', links: play },
    { title: 'Site', links: about },
  ]
}
