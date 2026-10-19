import { readFileSync } from 'node:fs'
import type { Plugin } from 'vite'
import { pageSeoFor, seoFor, staticPagesFor, type PageSeo, type SitemapPage, type StaticPage } from '../src/sites/seo.ts'
import { PORTAL, type Site } from '../src/sites/sites.ts'

/**
 * Generates the crawler files for the single-page site:
 * `robots.txt`, `sitemap.xml` and — when AdSense is configured — `ads.txt`.
 * They are emitted into the build and served by the dev server, and the
 * normalised site URL is filled into `index.html`.
 *
 * Link previews never run the app, so each page gets its own HTML too: a
 * copy of `index.html` with that page's title, description, canonical URL
 * and share card (`/trap-the-orb` → `trap-the-orb.html`). The dev server
 * fills in the same head for whichever page it serves.
 */

export interface SeoFilesOptions {
  /** Build identity. Defaults to the games portal. */
  readonly site?: Site
  /** Absolute http(s) base URL of the site. A trailing slash is ignored. */
  readonly siteUrl: string
  /** Google AdSense publisher id (`ca-pub-…`). `ads.txt` is only generated for a valid id. */
  readonly adsenseClient?: string | null
}

export interface SeoFile {
  readonly fileName: string
  readonly contentType: string
  readonly source: string
}

/** The parts of a Node request the dev middleware reads. */
export interface DevRequest {
  readonly url?: string
  readonly method?: string
}

/** The parts of a Node response the dev middleware writes. */
export interface DevResponse {
  statusCode: number
  setHeader(name: string, value: string): unknown
  end(body?: string): unknown
}

export type SeoMiddleware = (req: DevRequest, res: DevResponse, next: () => void) => void

const SITE_URL_PLACEHOLDER = '%VITE_SITE_URL%'
/** Where a page's own head goes in index.html; once filled, the same tags between markers. */
const PAGE_HEAD = /%PAGE_HEAD%|<!--page-head-->[\s\S]*?<!--\/page-head-->/
const ADSENSE_CLIENT_PATTERN = /^ca-pub-\d{10,20}$/
/** Google's ads.txt certification authority id — the same for every publisher. */
const GOOGLE_CERTIFICATION_AUTHORITY_ID = 'f08c47fec0942fa0'
const TEXT_TYPE = 'text/plain; charset=utf-8'
const XML_TYPE = 'application/xml; charset=utf-8'

const XML_ENTITIES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
}

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => XML_ENTITIES[char] ?? char)
}

function parseUrl(value: string): URL | null {
  try {
    return new URL(value.trim())
  } catch {
    return null
  }
}

/** Absolute http(s) URL without query, fragment or trailing slash. Throws for anything else. */
export function normalizeSiteUrl(siteUrl: string): string {
  const url = parseUrl(siteUrl)
  if (!url || (url.protocol !== 'https:' && url.protocol !== 'http:')) {
    throw new Error(`[seo-files] siteUrl must be an absolute http(s) URL, received "${siteUrl}"`)
  }
  return `${url.origin}${url.pathname}`.replace(/\/+$/, '')
}

export function buildRobotsTxt(siteUrl: string): string {
  return ['User-agent: *', 'Allow: /', '', `Sitemap: ${normalizeSiteUrl(siteUrl)}/sitemap.xml`, ''].join('\n')
}

/** Public pages worth indexing; everything else is a dialog, a per-player page or a variant of the game. */
/** Sitemap of the public pages; `lastmod` is the UTC date of `buildDate`. */
export function buildSitemapXml(siteUrl: string, buildDate: Date, pages: readonly SitemapPage[] = seoFor(PORTAL).sitemap): string {
  const base = normalizeSiteUrl(siteUrl)
  const lastmod = buildDate.toISOString().slice(0, 10)
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...pages.flatMap(({ path, changefreq, priority }) => [
      '  <url>',
      `    <loc>${escapeXml(`${base}${path}`)}</loc>`,
      `    <lastmod>${lastmod}</lastmod>`,
      `    <changefreq>${changefreq}</changefreq>`,
      `    <priority>${priority}</priority>`,
      '  </url>',
    ]),
    '</urlset>',
    '',
  ].join('\n')
}

/** The `ads.txt` line authorising Google to sell this site's inventory, or null for an invalid id. */
export function buildAdsTxt(adsenseClient: string | null | undefined): string | null {
  const client = adsenseClient?.trim() ?? ''
  if (!ADSENSE_CLIENT_PATTERN.test(client)) return null
  const publisherId = client.slice('ca-'.length)
  return `google.com, ${publisherId}, DIRECT, ${GOOGLE_CERTIFICATION_AUTHORITY_ID}\n`
}

export function buildSeoFiles(options: SeoFilesOptions, buildDate: Date): SeoFile[] {
  const files: SeoFile[] = [
    { fileName: 'robots.txt', contentType: TEXT_TYPE, source: buildRobotsTxt(options.siteUrl) },
    { fileName: 'sitemap.xml', contentType: XML_TYPE, source: buildSitemapXml(options.siteUrl, buildDate, seoFor(options.site ?? PORTAL).sitemap) },
  ]
  const adsTxt = buildAdsTxt(options.adsenseClient)
  return adsTxt === null ? files : [...files, { fileName: 'ads.txt', contentType: TEXT_TYPE, source: adsTxt }]
}

/** Replaces every `%VITE_SITE_URL%` placeholder with the given URL, taken literally. */
export function fillSiteUrl(html: string, siteUrl: string): string {
  return html.replaceAll(SITE_URL_PLACEHOLDER, () => escapeXml(siteUrl))
}

/** Fills the site's text and attribute placeholders, escaped. */
export function fillSiteHtml(html: string, site: Site, siteUrl: string): string {
  const seo = seoFor(site)
  const values: Readonly<Record<string, string>> = {
    SITE_NAME: site.name,
    SITE_THEME_COLOR: seo.themeColor,
    SITE_FAVICON: seo.favicon,
    SITE_ICON: seo.icon192,
    SITE_APPLE_ICON: seo.appleTouchIcon,
    SITE_MANIFEST: seo.manifest,
    SITE_NOSCRIPT: seo.noscript,
    NOT_FOUND_TITLE: seo.notFound.title,
    NOT_FOUND_DESCRIPTION: seo.notFound.description,
    NOT_FOUND_HEADLINE: seo.notFound.headline,
    NOT_FOUND_BODY: seo.notFound.body,
    NOT_FOUND_CTA: seo.notFound.cta,
    NOT_FOUND_CTA_HREF: seo.notFound.ctaHref,
  }
  const filled = html.replace(/%(SITE_[A-Z_]+|NOT_FOUND_[A-Z_]+)%/g, (token, key: string) =>
    values[key] === undefined ? token : escapeXml(values[key]),
  )
  return fillSiteUrl(filled, siteUrl)
}

/** A page's own head tags, between markers so that a built page can be refilled for another. JSON-LD cannot close its script element. */
export function renderPageHead(page: PageSeo): string {
  const meta = (attribute: 'name' | 'property', key: string, value: string): string => `<meta ${attribute}="${key}" content="${escapeXml(value)}" />`
  return [
    '<!--page-head-->',
    `<title>${escapeXml(page.title)}</title>`,
    meta('name', 'description', page.description),
    meta('name', 'robots', page.robots),
    `<link rel="canonical" href="${escapeXml(page.canonical)}" />`,
    meta('property', 'og:url', page.canonical),
    meta('property', 'og:title', page.shareTitle),
    meta('property', 'og:description', page.shareDescription),
    meta('property', 'og:image', page.image),
    meta('property', 'og:image:type', page.imageType),
    meta('property', 'og:image:width', '1200'),
    meta('property', 'og:image:height', '630'),
    meta('property', 'og:image:alt', page.imageAlt),
    meta('name', 'twitter:title', page.shareTitle),
    meta('name', 'twitter:description', page.shareDescription),
    meta('name', 'twitter:image', page.image),
    meta('name', 'twitter:image:alt', page.imageAlt),
    ...(page.jsonLd === null ? [] : [`<script type="application/ld+json">${JSON.stringify(page.jsonLd).replace(/</g, '\\u003c')}</script>`]),
    '<!--/page-head-->',
  ].join('\n    ')
}

/** Puts a page's head into index.html, or swaps it into a page that already has one. */
export function fillPageHead(html: string, page: PageSeo): string {
  return html.replace(PAGE_HEAD, () => renderPageHead(page))
}

/** The built file of a page: `/` is index.html, `/a/b` is a/b.html. */
export function pageFileName(path: string): string {
  return path === '/' ? 'index.html' : `${path.replace(/^\/+|\/+$/g, '')}.html`
}

/** The page whose HTML a path gets: its own, else its nearest parent's (a game mode gets the game's), else the home page. */
export function staticPageAt(pathname: string, pages: readonly StaticPage[]): StaticPage {
  for (let path = pathname.replace(/\/+$/, ''); path !== ''; path = path.slice(0, path.lastIndexOf('/'))) {
    const page = pages.find((candidate) => candidate.path === path)
    if (page) return page
  }
  return pages.find((page) => page.path === '/') ?? { path: '/', route: { page: 'home' } }
}

/** Dev-server middleware answering GET/HEAD for the generated files. */
export function createSeoMiddleware(files: readonly SeoFile[]): SeoMiddleware {
  const filesByPath = new Map(files.map((file) => [`/${file.fileName}`, file]))

  return (req, res, next) => {
    const { pathname } = new URL(req.url ?? '/', 'http://localhost')
    const file = filesByPath.get(pathname)
    const isRead = req.method === 'GET' || req.method === 'HEAD'
    if (!file || !isRead) {
      next()
      return
    }

    res.statusCode = 200
    res.setHeader('Content-Type', file.contentType)
    res.setHeader('Cache-Control', 'no-cache')
    res.end(req.method === 'HEAD' ? undefined : file.source)
  }
}

export function seoFiles(options: SeoFilesOptions): Plugin {
  const site = options.site ?? PORTAL
  const siteUrl = normalizeSiteUrl(options.siteUrl)
  const adsenseClient = options.adsenseClient?.trim() || null
  const notFoundHtml = fillSiteHtml(readFileSync(new URL('./404.html', import.meta.url), 'utf8'), site, siteUrl)
  const pages = staticPagesFor(site)
  const headOf = (page: StaticPage): PageSeo => pageSeoFor(page.route, site, siteUrl)
  const filesFor = (buildDate: Date): SeoFile[] => [
    ...buildSeoFiles({ site, siteUrl, adsenseClient }, buildDate),
    { fileName: '404.html', contentType: 'text/html; charset=utf-8', source: notFoundHtml },
  ]

  return {
    name: 'games:seo-files',
    transformIndexHtml: {
      // Runs before Vite's own %ENV% replacement, so the HTML always gets the normalised URL.
      order: 'pre',
      // The build fills index.html in as the home page; the dev server, as the page it serves.
      handler: (html, context) => {
        const { pathname } = new URL(context.originalUrl ?? '/', 'http://localhost')
        return fillPageHead(fillSiteHtml(html, site, siteUrl), headOf(staticPageAt(pathname, pages)))
      },
    },
    configureServer(server) {
      server.middlewares.use(createSeoMiddleware(filesFor(new Date())))
    },
    generateBundle: {
      // After Vite has put index.html, with its scripts and styles, into the bundle.
      order: 'post',
      handler(_options, bundle) {
        if (adsenseClient !== null && buildAdsTxt(adsenseClient) === null) {
          this.warn('The AdSense client id is malformed (expected ca-pub-…), so ads.txt was not generated')
        }
        for (const file of filesFor(new Date())) {
          this.emitFile({ type: 'asset', fileName: file.fileName, source: file.source })
        }
        const index = bundle['index.html']
        if (index?.type !== 'asset') {
          this.warn('index.html is not in the bundle, so no page got its own title and link preview')
          return
        }
        const html = typeof index.source === 'string' ? index.source : new TextDecoder().decode(index.source)
        for (const page of pages) {
          if (page.path !== '/') this.emitFile({ type: 'asset', fileName: pageFileName(page.path), source: fillPageHead(html, headOf(page)) })
        }
      },
    },
  }
}
