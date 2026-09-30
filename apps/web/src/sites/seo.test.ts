import { afterEach, describe, expect, it } from 'vitest'
import { updateDocumentMetadata } from '@/app/useDocumentTitle'
import { pageSeoFor, seoFor } from './seo'
import { PORTAL, siteById } from './sites'

const GAME_SITE = siteById('traptheorb')

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

  it('uses configured domain branding and leaderboard paths in the document', () => {
    updateDocumentMetadata({ page: 'leaderboards', game: 'trap-the-orb' }, GAME_SITE, 'https://staging.example')
    expect(document.title).toBe('Leaderboards — Trap The Orb')
    expect(document.querySelector('meta[property="og:site_name"]')).toHaveAttribute('content', 'Trap The Orb')
    expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute('href', 'https://staging.example/leaderboards')
    expect(document.querySelector('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.webmanifest')
    expect(document.querySelector('script[type="application/ld+json"]')).toHaveTextContent('null')
  })
})
