import { describe, expect, it } from 'vitest'
import { createPaths, isExternalHref } from './paths'
import { parseRoute, routeGame } from './routes'
import { isSiteId, PORTAL, resolveSite, siteById } from './sites'

const GAME_SITE = siteById('traptheorb')

describe('site resolution', () => {
  it.each([undefined, '', 'localhost', '127.0.0.1', 'games.mucahid.dev', 'preview.games.mucahid.dev', 'unrelated.example'])('opens the portal on %s', (hostname) => {
    expect(resolveSite({ hostname })).toBe(PORTAL)
  })

  it.each(['traptheorb.com', 'www.traptheorb.com', 'TRAPTHEORB.COM', ' traptheorb.com. ', 'traptheorb.localhost'])('uses game branding on %s', (hostname) => {
    expect(resolveSite({ hostname })).toBe(GAME_SITE)
  })

  it.each(['nottraptheorb.com', 'traptheorb.com.attacker.test'])('does not confuse similar domains with a game domain: %s', (hostname) => {
    expect(resolveSite({ hostname })).toBe(PORTAL)
  })

  it('lets an explicit build selection override the host, including preview hosts', () => {
    expect(resolveSite({ hostname: 'traptheorb.com', override: 'portal' })).toBe(PORTAL)
    expect(resolveSite({ hostname: 'preview.example', override: ' traptheorb ' })).toBe(GAME_SITE)
    expect(resolveSite({ hostname: 'traptheorb.com', override: 'invalid' })).toBe(GAME_SITE)
    expect(isSiteId('invalid')).toBe(false)
    expect(isSiteId(null)).toBe(false)
  })
})

describe('site paths and routes', () => {
  it.each([PORTAL, GAME_SITE])('round-trips navigation on $id', (site) => {
    const paths = createPaths(site)
    expect(parseRoute(paths.home(), site)).toEqual(site.kind === 'portal' ? { page: 'home' } : { page: 'play', game: 'trap-the-orb', mode: null })
    expect(parseRoute(paths.game('trap-the-orb'), site)).toEqual({ page: 'play', game: 'trap-the-orb', mode: null })
    expect(parseRoute(paths.play('trap-the-orb', 'timeAttack'), site)).toEqual({ page: 'play', game: 'trap-the-orb', mode: 'timeAttack' })
    expect(parseRoute(paths.leaderboards('trap-the-orb'), site)).toEqual({ page: 'leaderboards', game: 'trap-the-orb' })
    expect(parseRoute(paths.profile(), site)).toEqual({ page: 'profile' })
    expect(paths.leaderboards('trap-the-orb', '?board=daily')).toBe(`${paths.leaderboards('trap-the-orb')}?board=daily`)
  })

  it('keeps the game under its own prefix only on the portal', () => {
    expect(createPaths(PORTAL).game('trap-the-orb')).toBe('/trap-the-orb')
    expect(createPaths(GAME_SITE).game('trap-the-orb')).toBe('/')
    expect(createPaths(PORTAL).allGames()).toBe('/')
    expect(createPaths(GAME_SITE).allGames()).toBe(PORTAL.url)
    expect(isExternalHref(createPaths(GAME_SITE).allGames())).toBe(true)
    expect(isExternalHref('/trap-the-orb')).toBe(false)
  })

  it('normalizes trailing slashes but rejects missing games, modes and extra segments', () => {
    expect(parseRoute('/trap-the-orb/', PORTAL)).toEqual({ page: 'play', game: 'trap-the-orb', mode: null })
    for (const path of ['/leaderboards', '/play/classic', '/missing', '/trap-the-orb/play/nope', '/trap-the-orb/play/classic/extra']) {
      expect(parseRoute(path, PORTAL), path).toEqual({ page: 'notFound' })
    }
    expect(parseRoute('/trap-the-orb', GAME_SITE)).toEqual({ page: 'notFound' })
    expect(routeGame(parseRoute('/trap-the-orb', PORTAL))).toBe('trap-the-orb')
    expect(routeGame(parseRoute('/', PORTAL))).toBeNull()
  })
})
