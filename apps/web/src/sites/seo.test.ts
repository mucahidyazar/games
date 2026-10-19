import { afterEach, describe, expect, it } from 'vitest'
import { updateDocumentMetadata } from '@/app/useDocumentTitle'
import { GAMES } from './games'
import { parseRoute } from './routes'
import { imageTypeOf, pageSeoFor, seoFor, staticPagesFor } from './seo'
import { PORTAL, siteById } from './sites'

const GAME_SITE = siteById('traptheorb')

describe('link previews', () => {
  it.each(GAMES.map((game) => [game.name, game] as const))('show %s with its own title, copy and cover', (_name, game) => {
    const page = pageSeoFor({ page: 'play', game: game.id, mode: null }, PORTAL)
    expect(page.shareTitle).toBe(`${game.name} — ${game.tagline}`)
    expect(page.shareDescription).toBe(game.description)
    expect(page.image).toBe(`${PORTAL.url}${game.cover}`)
    expect(page.imageAlt).toBe(game.coverAlt)
    expect(page.canonical).toBe(`${PORTAL.url}/${game.id}`)
  })

  it('show the portal with its own image rather than one game’s cover', () => {
    const page = pageSeoFor({ page: 'home' }, PORTAL)
    expect(page.image).toBe(`${PORTAL.url}/portal/og-image.jpg`)
    expect(page.imageType).toBe('image/jpeg')
    for (const game of GAMES) expect(page.imageAlt).toContain(game.name)
    expect(page.shareTitle).toBe(seoFor(PORTAL).ogTitle)
  })

  it('show a game’s leaderboards with that game’s cover', () => {
    const page = pageSeoFor({ page: 'leaderboards', game: 'trap-the-orb' }, PORTAL)
    expect(page.image).toBe(`${PORTAL.url}/og-image.png`)
    expect(page.shareTitle).toBe('Leaderboards — Trap The Orb')
  })

  it('tell the image type from the file', () => {
    expect(imageTypeOf('/a/cover.png')).toBe('image/png')
    expect(imageTypeOf('/a/card.JPG')).toBe('image/jpeg')
    expect(() => imageTypeOf('/a/cover.gif')).toThrow(/image type/)
  })
})

describe('static pages', () => {
  it('give the portal home, its pages and every game page their own HTML', () => {
    expect(staticPagesFor(PORTAL).map((page) => page.path)).toEqual(['/', '/about', '/profile', '/trap-the-orb', '/trap-the-orb/leaderboards', '/absurd-trolley-problems'])
  })

  it('make the game the home page of its own site', () => {
    expect(staticPagesFor(GAME_SITE)).toEqual([
      { path: '/', route: { page: 'play', game: 'trap-the-orb', mode: null } },
      { path: '/about', route: { page: 'about' } },
      { path: '/profile', route: { page: 'profile' } },
      { path: '/leaderboards', route: { page: 'leaderboards', game: 'trap-the-orb' } },
    ])
  })

  it.each([PORTAL, GAME_SITE])('are the routes the app shows at those paths on $id', (site) => {
    for (const { path, route } of staticPagesFor(site)) expect(parseRoute(path, site), path).toEqual(route)
  })
})

describe('page metadata', () => {
  afterEach(() => { document.head.innerHTML = '' })

  it('canonicalizes portal mode variants to the game landing page', () => {
    const page = pageSeoFor({ page: 'play', game: 'trap-the-orb', mode: 'daily' }, PORTAL)
    expect(page.title).toBe('Trap The Orb — games.mucahid.dev')
    expect(page.canonical).toBe('https://games.mucahid.dev/trap-the-orb')
    expect(page.jsonLd).toMatchObject({ '@type': 'VideoGame', url: page.canonical })
  })

  it('uses the standalone origin and root for the same game', () => {
    const page = pageSeoFor({ page: 'play', game: 'trap-the-orb', mode: 'classic' }, GAME_SITE)
    expect(page.title).toBe(seoFor(GAME_SITE).title)
    expect(page.canonical).toBe('https://traptheorb.com/')
  })

  it('does not index personal and missing pages', () => {
    expect(pageSeoFor({ page: 'profile' }, PORTAL).robots).toBe('noindex,follow')
    expect(pageSeoFor({ page: 'notFound' }, GAME_SITE).robots).toBe('noindex,follow')
  })

  it('updates share metadata, canonical and indexability when navigating back to the portal', () => {
    updateDocumentMetadata({ page: 'profile' }, PORTAL, PORTAL.url)
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex,follow')
    updateDocumentMetadata({ page: 'play', game: 'trap-the-orb', mode: 'daily' }, PORTAL, PORTAL.url)
    expect(document.title).toBe('Trap The Orb — games.mucahid.dev')
    expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute('href', 'https://games.mucahid.dev/trap-the-orb')
    expect(document.querySelector('meta[property="og:url"]')).toHaveAttribute('content', 'https://games.mucahid.dev/trap-the-orb')
    updateDocumentMetadata({ page: 'home' }, PORTAL, PORTAL.url)
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'index,follow')
    expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute('href', 'https://games.mucahid.dev/')
    expect(document.querySelectorAll('link[rel="canonical"]')).toHaveLength(1)
    expect(document.querySelector('link[rel="manifest"]')).toHaveAttribute('href', '/portal/manifest.webmanifest')
  })

  it('switches the link preview to the page’s own when navigating', () => {
    updateDocumentMetadata({ page: 'home' }, PORTAL, PORTAL.url)
    expect(document.querySelector('meta[property="og:image:type"]')).toHaveAttribute('content', 'image/jpeg')
    updateDocumentMetadata({ page: 'play', game: 'absurd-trolley-problems', mode: null }, PORTAL, PORTAL.url)
    expect(document.querySelector('meta[property="og:title"]')).toHaveAttribute('content', 'Absurd Trolley Problems — Pull the lever. Or don’t.')
    expect(document.querySelector('meta[name="twitter:image"]')).toHaveAttribute('content', 'https://games.mucahid.dev/games/absurd-trolley-problems/cover.png')
    expect(document.querySelector('meta[property="og:image:type"]')).toHaveAttribute('content', 'image/png')
    expect(document.title).toBe('Absurd Trolley Problems — games.mucahid.dev')
  })

  it('uses configured domain branding and leaderboard paths in the document', () => {
    updateDocumentMetadata({ page: 'play', game: 'trap-the-orb', mode: null }, GAME_SITE, 'https://staging.example')
    expect(document.querySelector('script[type="application/ld+json"]')).not.toBeNull()
    updateDocumentMetadata({ page: 'leaderboards', game: 'trap-the-orb' }, GAME_SITE, 'https://staging.example')
    expect(document.title).toBe('Leaderboards — Trap The Orb')
    expect(document.querySelector('meta[property="og:site_name"]')).toHaveAttribute('content', 'Trap The Orb')
    expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute('href', 'https://staging.example/leaderboards')
    expect(document.querySelector('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.webmanifest')
    // Leaderboards have no structured data, so the home page's is taken away.
    expect(document.querySelector('script[type="application/ld+json"]')).toBeNull()
  })
})
