import { GAMES, gameById, type GameEntry } from './games.ts'
import { createPaths } from './paths.ts'
import type { Route } from './routes.ts'
import { PORTAL, type Site } from './sites.ts'

/**
 * Everything in <head> that differs between the sites, plus the sitemap and
 * the not-found page copy. Pure data: the build plugin fills index.html and
 * 404.html from it, and the app sets page titles from it.
 */

export interface SitemapPage {
  readonly path: string
  readonly changefreq: 'daily' | 'weekly' | 'monthly'
  readonly priority: string
}

export interface NotFoundCopy {
  readonly title: string
  readonly description: string
  readonly headline: string
  readonly body: string
  readonly cta: string
  readonly ctaHref: string
}

export interface SiteSeo {
  readonly title: string
  readonly description: string
  readonly ogTitle: string
  readonly ogDescription: string
  /** Paths under public/. */
  readonly ogImage: string
  readonly ogImageAlt: string
  readonly favicon: string
  readonly icon192: string
  readonly appleTouchIcon: string
  readonly manifest: string
  readonly themeColor: string
  readonly noscript: string
  readonly sitemap: readonly SitemapPage[]
  readonly notFound: NotFoundCopy
  /** Structured data for the home page, given the canonical site URL. */
  jsonLd(siteUrl: string): unknown
}

/** Initial browser chrome matches the default Navy Dark theme. */
export const THEME_COLOR = '#0b1630'

function videoGameJsonLd(game: GameEntry, url: string, siteUrl: string): Record<string, unknown> {
  return {
    '@type': 'VideoGame',
    '@id': `${url}#game`,
    name: game.name,
    url,
    description: game.description,
    image: `${siteUrl}${game.cover}`,
    genre: [gameById(game.id).tags[0] ?? 'Arcade'],
    gamePlatform: 'Web browser',
    applicationCategory: 'GameApplication',
    operatingSystem: 'Any',
    playMode: 'SinglePlayer',
    isAccessibleForFree: true,
    inLanguage: 'en',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  }
}

function portalSeo(): SiteSeo {
  const paths = createPaths(PORTAL)
  return {
    title: 'games.mucahid.dev — Free browser games',
    description:
      'Free games that run right in your browser — no download, no sign-up needed. Play Trap The Orb, climb the leaderboards and earn badges.',
    ogTitle: 'games.mucahid.dev — Free browser games',
    ogDescription: 'Small, sharp games you can play in seconds. No download, no sign-up needed.',
    ogImage: GAMES[0]?.cover ?? '/og-image.png',
    ogImageAlt: 'Play Trap The Orb and discover free browser games on games.mucahid.dev.',
    favicon: '/portal/favicon.svg',
    icon192: '/icon-192.png',
    appleTouchIcon: '/apple-touch-icon.png',
    manifest: '/portal/manifest.webmanifest',
    themeColor: THEME_COLOR,
    noscript: 'games.mucahid.dev needs JavaScript to run its games. Please turn on JavaScript in your browser settings.',
    sitemap: [
      { path: '/', changefreq: 'weekly', priority: '1.0' },
      { path: paths.about(), changefreq: 'monthly', priority: '0.5' },
      ...GAMES.flatMap((game): SitemapPage[] => [
        { path: paths.game(game.id), changefreq: 'weekly', priority: '0.9' },
        { path: paths.leaderboards(game.id), changefreq: 'daily', priority: '0.6' },
      ]),
    ],
    notFound: {
      title: 'Page not found — games.mucahid.dev',
      description: 'This page doesn’t exist. Head back to games.mucahid.dev to find a game to play.',
      headline: 'Page not found',
      body: 'The link may be old or mistyped. The games are still right here.',
      cta: 'Browse games',
      ctaHref: '/',
    },
    jsonLd: (siteUrl) => ({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebSite',
          '@id': `${siteUrl}/#website`,
          url: `${siteUrl}/`,
          name: 'games.mucahid.dev',
          description: 'Free browser games by Mucahid: no download, no sign-up needed.',
          inLanguage: 'en',
          publisher: { '@id': `${siteUrl}/#publisher` },
        },
        {
          '@type': 'Person',
          '@id': `${siteUrl}/#publisher`,
          name: 'Mucahid',
          url: 'https://mucahid.dev',
        },
        {
          '@type': 'ItemList',
          '@id': `${siteUrl}/#games`,
          name: 'Games',
          itemListElement: GAMES.map((game, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            item: videoGameJsonLd(game, `${siteUrl}${paths.game(game.id)}`, siteUrl),
          })),
        },
      ],
    }),
  }
}

function gameSeo(site: Site & { kind: 'game' }): SiteSeo {
  const game = gameById(site.game)
  const paths = createPaths(site)
  return {
    title: `${game.name} — Free Online Arcade Game | No Sign-up`,
    description:
      'Play Trap The Orb free in your browser — no sign-up, no download. Build walls, trap the bouncing orbs and claim 75% of the field to clear each level.',
    ogTitle: `${game.name} — Play Free Online`,
    ogDescription: `${game.tagline} Build walls, box in the bouncing orbs and capture the field — free in your browser, no sign-up.`,
    ogImage: game.cover,
    ogImageAlt: `${game.name} — ${game.tagline} ${game.coverAlt}`,
    favicon: '/favicon.svg',
    icon192: '/icon-192.png',
    appleTouchIcon: '/apple-touch-icon.png',
    manifest: '/manifest.webmanifest',
    themeColor: THEME_COLOR,
    noscript: `${game.name} needs JavaScript to run. Please turn on JavaScript in your browser settings to play.`,
    sitemap: [
      { path: '/', changefreq: 'weekly', priority: '1.0' },
      { path: paths.about(), changefreq: 'monthly', priority: '0.5' },
      { path: paths.leaderboards(game.id), changefreq: 'daily', priority: '0.7' },
    ],
    notFound: {
      title: `Page not found — ${game.name}`,
      description: `This page doesn’t exist. Head back to ${game.name} to keep trapping orbs.`,
      headline: 'This page got trapped',
      body: 'The link may be old or mistyped. The game is still right here.',
      cta: 'Play now',
      ctaHref: '/',
    },
    jsonLd: (siteUrl) => ({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebSite',
          '@id': `${siteUrl}/#website`,
          url: `${siteUrl}/`,
          name: game.name,
          description: `${game.tagline} A free arcade game for your browser, with no download and no sign-up.`,
          inLanguage: 'en',
          publisher: { '@id': `${siteUrl}/#organization` },
        },
        {
          ...videoGameJsonLd(game, `${siteUrl}/`, siteUrl),
          genre: ['Arcade', 'Puzzle'],
          publisher: {
            '@type': 'Organization',
            '@id': `${siteUrl}/#organization`,
            name: game.name,
            url: `${siteUrl}/`,
            logo: `${siteUrl}/icon-512.png`,
          },
        },
      ],
    }),
  }
}

export function seoFor(site: Site): SiteSeo {
  return site.kind === 'portal' ? portalSeo() : gameSeo(site)
}

export interface PageSeo {
  readonly title: string
  readonly description: string
  readonly canonical: string
  readonly image: string
  readonly imageAlt: string
  readonly robots: 'index,follow' | 'noindex,follow'
  readonly jsonLd: unknown
}

/** Canonical game URLs omit mode/query variants; personal and missing pages are not indexed. */
export function pageSeoFor(route: Route, site: Site, siteUrl = site.url): PageSeo {
  const seo = seoFor(site)
  const paths = createPaths(site)
  const base = {
    title: seo.title,
    description: seo.description,
    canonical: `${siteUrl}/`,
    image: `${siteUrl}${seo.ogImage}`,
    imageAlt: seo.ogImageAlt,
    robots: 'index,follow' as const,
    jsonLd: seo.jsonLd(siteUrl),
  }
  switch (route.page) {
    case 'home':
      return base
    case 'play': {
      const game = gameById(route.game)
      const canonical = `${siteUrl}${paths.game(game.id)}`
      return {
        ...base,
        title: site.kind === 'game' ? seo.title : `${game.name} — ${site.name}`,
        description: game.description,
        canonical,
        image: `${siteUrl}${game.cover}`,
        imageAlt: game.coverAlt,
        jsonLd: { '@context': 'https://schema.org', ...videoGameJsonLd(game, canonical, siteUrl) },
      }
    }
    case 'leaderboards':
      return {
        ...base,
        title: `Leaderboards — ${gameById(route.game).name}`,
        description: `Explore ${gameById(route.game).name} high scores, daily challenges and player records.`,
        canonical: `${siteUrl}${paths.leaderboards(route.game)}`,
        jsonLd: null,
      }
    case 'profile':
      return { ...base, title: `Your profile — ${site.name}`, canonical: `${siteUrl}${paths.profile()}`, robots: 'noindex,follow', jsonLd: null }
    case 'about':
      return { ...base, title: `About ${site.name}`, description: `Learn more about ${site.name} and the games made by Mucahid.`, canonical: `${siteUrl}${paths.about()}`, jsonLd: null }
    case 'notFound':
      return { ...base, title: seo.notFound.title, description: seo.notFound.description, robots: 'noindex,follow', jsonLd: null }
  }
}
