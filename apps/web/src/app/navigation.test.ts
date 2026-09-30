import { describe, expect, it } from 'vitest'
import { dialogFromHash, footerColumnsFor, navItemsFor } from './navigation'
import { createPaths } from '@/sites/paths'
import { PORTAL, siteById } from '@/sites/sites'
import type { Route } from '@/sites/routes'

const portalPaths = createPaths(PORTAL)
const gameSite = siteById('traptheorb')
const gamePaths = createPaths(gameSite)

const labels = (items: readonly { label: string }[]) => items.map((item) => item.label)

const portalHome: Route = { page: 'home' }
const portalPlay: Route = { page: 'play', game: 'trap-the-orb', mode: null }
const gameAbout: Route = { page: 'about' }

describe('navigation helpers', () => {
  it('builds portal home navigation and links About to its page', () => {
    const items = navItemsFor(PORTAL, portalHome, portalPaths)

    expect(labels(items)).toEqual(['Games', 'Categories', 'About'])
    expect(items.map((item) => item.href)).toEqual(['/', '/#categories', '/about'])
    expect(items[2]?.isActive).toBe(false)
  })

  it('uses the portal game paths while a game is open', () => {
    const items = navItemsFor(PORTAL, portalPlay, portalPaths)

    expect(labels(items)).toEqual(['All games', 'Play', 'Leaderboards', 'How to play'])
    expect(items.map((item) => item.href)).toEqual(['/', '/trap-the-orb', '/trap-the-orb/leaderboards', '#how-to-play'])
    expect(items[1]?.isActive).toBe(true)
  })

  it('uses root game paths and an external More games link on a game domain', () => {
    const route: Route = { page: 'leaderboards', game: 'trap-the-orb' }
    const items = navItemsFor(gameSite, route, gamePaths)

    expect(labels(items)).toEqual(['Play', 'Leaderboards', 'How to play', 'About', 'More games'])
    expect(items.map((item) => item.href)).toEqual(['/', '/leaderboards', '#how-to-play', '/about', 'https://games.mucahid.dev'])
    expect(items[4]).toMatchObject({ isExternal: true })
  })

  it('keeps footer columns aligned with the current portal and game domain', () => {
    const portalFooter = footerColumnsFor(PORTAL, portalHome, portalPaths)
    expect(portalFooter[0]?.links.map((link) => link.href)).toEqual(['/', '/#categories'])
    expect(portalFooter[1]?.links.map((link) => link.href)).toEqual(['/about', '#privacy', 'https://mucahid.dev'])

    const gameFooter = footerColumnsFor(gameSite, gameAbout, gamePaths)
    expect(gameFooter[0]?.links.map((link) => link.href)).toEqual(['/', '/leaderboards', '#how-to-play', '/#apps'])
    expect(gameFooter[1]?.links.map((link) => link.href)).toEqual(['/about', '#privacy', 'https://games.mucahid.dev', 'https://mucahid.dev'])
  })
})

describe('dialog hash parsing', () => {
  it('accepts supported dialog hashes and ignores the legacy About hash', () => {
    expect(dialogFromHash('#privacy')).toBe('privacy')
    expect(dialogFromHash('#account')).toBe('account')
    expect(dialogFromHash('#about')).toBeNull()
    expect(dialogFromHash('')).toBeNull()
  })
})
