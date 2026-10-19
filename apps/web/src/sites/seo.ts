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
    genre: [game.tags[0] ?? 'Arcade'],
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
      'Free games that run right in your browser — no download, no sign-up needed. Play Trap The Orb and Absurd Trolley Problems, climb the leaderboards and earn badges.',
    ogTitle: 'games.mucahid.dev — Free browser games',
    ogDescription: 'Small, sharp games you can play in seconds. No download, no sign-up needed.',
    ogImage: '/portal/og-image.jpg',
    ogImageAlt: `games.mucahid.dev: “Play in seconds. Make it count.” beside the covers of ${GAMES.map((game) => game.name).join(' and ')}.`,
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
        ...(game.hasLeaderboards ? [{ path: paths.leaderboards(game.id), changefreq: 'daily', priority: '0.6' } as const] : []),
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
  /** The link preview (Open Graph and X cards): what chat apps and social sites show for a shared link. */
  readonly shareTitle: string
  readonly shareDescription: string
  /** Absolute URL of a 1200 × 630 image. */
  readonly image: string
  readonly imageType: string
  readonly imageAlt: string
  readonly robots: 'index,follow' | 'noindex,follow'
  /** Structured data, or null for pages without any. */
  readonly jsonLd: unknown
}

const IMAGE_TYPES: Readonly<Record<string, string>> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' }

/** The media type of an image, from its file extension. */
export function imageTypeOf(path: string): string {
  const type = IMAGE_TYPES[/\.(\w+)$/.exec(path)?.[1]?.toLowerCase() ?? '']
  if (!type) throw new Error(`No image type for ${path}`)
  return type
}

/** A page the build writes its own HTML for, so links to it get its own title and preview without running the app. */
export interface StaticPage {
  readonly path: string
  readonly route: Route
}

/**
 * The site's pages that get their own HTML. Deeper routes without one (a
 * game mode, `/trap-the-orb/play/daily`) are served their nearest parent's.
 */
export function staticPagesFor(site: Site): readonly StaticPage[] {
  const paths = createPaths(site)
  const games = site.kind === 'game' ? [gameById(site.game)] : GAMES
  const pages: StaticPage[] = [
    site.kind === 'game' ? { path: '/', route: { page: 'play', game: site.game, mode: null } } : { path: '/', route: { page: 'home' } },
    { path: paths.about(), route: { page: 'about' } },
    { path: paths.profile(), route: { page: 'profile' } },
    ...games.flatMap((game): StaticPage[] => [
      { path: paths.game(game.id), route: { page: 'play', game: game.id, mode: null } },
      ...(game.hasLeaderboards ? [{ path: paths.leaderboards(game.id), route: { page: 'leaderboards', game: game.id } } as const] : []),
    ]),
  ]
  // On a game's own site the game is the home page.
  return pages.filter((page, index) => pages.findIndex((other) => other.path === page.path) === index)
}

/** Canonical game URLs omit mode/query variants; personal and missing pages are not indexed. */
export function pageSeoFor(route: Route, site: Site, siteUrl = site.url): PageSeo {
  const seo = seoFor(site)
  const paths = createPaths(site)
  const page = (title: string, description: string, canonical: string, image = seo.ogImage, imageAlt = seo.ogImageAlt): PageSeo => ({
    title,
    description,
    canonical: `${siteUrl}${canonical}`,
    shareTitle: title,
    shareDescription: description,
    image: `${siteUrl}${image}`,
    imageType: imageTypeOf(image),
    imageAlt,
    robots: 'index,follow',
    jsonLd: null,
  })
  const home = (): PageSeo => ({ ...page(seo.title, seo.description, '/'), shareTitle: seo.ogTitle, shareDescription: seo.ogDescription, jsonLd: seo.jsonLd(siteUrl) })
  switch (route.page) {
    case 'home':
      return home()
    case 'play': {
      // On a game's own site the game is the home page.
      if (site.kind === 'game') return home()
      const game = gameById(route.game)
      const canonical = paths.game(game.id)
      return {
        ...page(`${game.name} — ${site.name}`, game.description, canonical, game.cover, game.coverAlt),
        shareTitle: `${game.name} — ${game.tagline}`,
        jsonLd: { '@context': 'https://schema.org', ...videoGameJsonLd(game, `${siteUrl}${canonical}`, siteUrl) },
      }
    }
    case 'leaderboards': {
      const game = gameById(route.game)
      return page(`Leaderboards — ${game.name}`, `Explore ${game.name} high scores, daily challenges and player records.`, paths.leaderboards(game.id), game.cover, game.coverAlt)
    }
    case 'profile':
      return { ...page(`Your profile — ${site.name}`, seo.description, paths.profile()), robots: 'noindex,follow' }
    case 'about':
      return page(`About ${site.name}`, `Learn more about ${site.name} and the games made by Mucahid.`, paths.about())
    case 'notFound':
      return { ...page(seo.notFound.title, seo.notFound.description, '/'), robots: 'noindex,follow' }
  }
}
