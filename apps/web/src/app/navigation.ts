import { gameById } from '@/sites/games'
import type { SitePaths } from '@/sites/paths'
import { routeGame, type Route } from '@/sites/routes'
import type { Site } from '@/sites/sites'
import { CHROME } from './copy'
import type { Lang } from './lang'

export const DIALOG_IDS = ['how-to-play', 'privacy', 'privacy-settings', 'account'] as const

export type DialogId = (typeof DIALOG_IDS)[number]

export type NavItemId =
  | 'games'
  | 'categories'
  | 'about'
  | 'allGames'
  | 'play'
  | 'leaderboards'
  | 'howToPlay'
  | 'moreGames'
  | 'mobileApp'
  | 'privacy'
  | 'maker'

export interface NavItem {
  readonly id: NavItemId
  readonly label: string
  /** A page path, a page section (`/#games`), a dialog (`#privacy`) or an external URL. */
  readonly href: string
  readonly isActive: boolean
  readonly badge?: string
  /** Opens another site (the portal from a game's own domain). */
  readonly isExternal?: boolean
}

type LinkId = Exclude<NavItemId, 'maker'>

/**
 * The header links for the page in view. The portal shows its own links until
 * a game is open, when the game's links take over; a game's own site always
 * shows the game's links plus a way back to every game.
 */
export function navItemsFor(site: Site, route: Route, paths: SitePaths, lang: Lang = 'en'): readonly NavItem[] {
  const item = (id: LinkId, href: string, isActive = false): NavItem => ({ id, label: CHROME.nav[id][lang], href, isActive })
  const gameId = site.kind === 'game' ? site.game : routeGame(route)

  if (!gameId) {
    return [item('games', paths.home(), route.page === 'home'), item('categories', '/#categories'), item('about', paths.about(), route.page === 'about')]
  }

  const game = gameById(gameId)
  const gameLinks = [
    item('play', paths.game(gameId), route.page === 'play'),
    ...(game.hasLeaderboards ? [item('leaderboards', paths.leaderboards(gameId), route.page === 'leaderboards')] : []),
    item('howToPlay', '#how-to-play'),
  ]
  if (site.kind === 'portal') return [item('allGames', paths.home()), ...gameLinks]
  return [
    ...gameLinks,
    item('about', paths.about(), route.page === 'about'),
    { ...item('moreGames', paths.allGames()), isExternal: true, badge: game.siteUrl ? undefined : CHROME.badges.new[lang] },
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
export function footerColumnsFor(site: Site, route: Route, paths: SitePaths, lang: Lang = 'en'): readonly FooterColumn[] {
  const item = (id: LinkId, href: string, isActive = false): NavItem => ({ id, label: CHROME.nav[id][lang], href, isActive })
  const gameId = site.kind === 'game' ? site.game : routeGame(route)
  const game = gameId ? gameById(gameId) : null
  const play: NavItem[] = gameId && game
    ? [
        item('play', paths.game(gameId), route.page === 'play'),
        ...(game.hasLeaderboards ? [item('leaderboards', paths.leaderboards(gameId), route.page === 'leaderboards')] : []),
        item('howToPlay', '#how-to-play'),
        ...(game.hasMobileApp ? [{ ...item('mobileApp', `${paths.game(gameId)}#apps`), badge: CHROME.badges.soon[lang] }] : []),
      ]
    : [item('allGames', paths.home(), route.page === 'home'), item('categories', '/#categories')]
  if (site.kind === 'portal' && gameId) play.unshift(item('allGames', paths.home()))

  const about: NavItem[] = [item('about', paths.about(), route.page === 'about'), item('privacy', '#privacy')]
  if (site.kind === 'game') about.push({ ...item('moreGames', paths.allGames()), isExternal: true })
  about.push({ id: 'maker', label: 'mucahid.dev', href: 'https://mucahid.dev', isActive: false, isExternal: true })

  return [
    { title: CHROME.footer.play[lang], links: play },
    { title: CHROME.footer.site[lang], links: about },
  ]
}
