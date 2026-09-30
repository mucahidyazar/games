import { readFileSync } from 'node:fs'
import type { Plugin } from 'vite'
import { seoFor, type SitemapPage } from '../src/sites/seo.ts'
import { PORTAL, type Site } from '../src/sites/sites.ts'

/**
 * Generates the crawler files for the single-page site:
 * `robots.txt`, `sitemap.xml` and — when AdSense is configured — `ads.txt`.
 * They are emitted into the build and served by the dev server, and the
 * normalised site URL is filled into `index.html`.
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

/** Fill text/attribute placeholders safely; JSON-LD stays JSON and cannot close its script tag. */
export function fillSiteHtml(html: string, site: Site, siteUrl: string): string {
  const seo = seoFor(site)
  const values: Readonly<Record<string, string>> = {
    SITE_NAME: site.name,
    SITE_TITLE: seo.title,
    SITE_DESCRIPTION: seo.description,
    SITE_THEME_COLOR: seo.themeColor,
    SITE_FAVICON: seo.favicon,
    SITE_ICON: seo.icon192,
    SITE_APPLE_ICON: seo.appleTouchIcon,
    SITE_MANIFEST: seo.manifest,
    SITE_OG_TITLE: seo.ogTitle,
    SITE_OG_DESCRIPTION: seo.ogDescription,
    SITE_OG_IMAGE: `${siteUrl}${seo.ogImage}`,
    SITE_OG_ALT: seo.ogImageAlt,
    SITE_NOSCRIPT: seo.noscript,
    NOT_FOUND_TITLE: seo.notFound.title,
    NOT_FOUND_DESCRIPTION: seo.notFound.description,
    NOT_FOUND_HEADLINE: seo.notFound.headline,
    NOT_FOUND_BODY: seo.notFound.body,
    NOT_FOUND_CTA: seo.notFound.cta,
    NOT_FOUND_CTA_HREF: seo.notFound.ctaHref,
  }
  const filled = html.replace(/%(SITE_[A-Z_]+|NOT_FOUND_[A-Z_]+)%/g, (token, key: string) => {
    if (key === 'SITE_JSON_LD') return JSON.stringify(seo.jsonLd(siteUrl)).replace(/</g, '\\u003c')
    return values[key] === undefined ? token : escapeXml(values[key])
  })
  return fillSiteUrl(filled, siteUrl)
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
  const filesFor = (buildDate: Date): SeoFile[] => [
    ...buildSeoFiles({ site, siteUrl, adsenseClient }, buildDate),
    { fileName: '404.html', contentType: 'text/html; charset=utf-8', source: notFoundHtml },
  ]

  return {
    name: 'games:seo-files',
    transformIndexHtml: {
      // Runs before Vite's own %ENV% replacement, so the HTML always gets the normalised URL.
      order: 'pre',
      handler: (html) => fillSiteHtml(html, site, siteUrl),
    },
    configureServer(server) {
      server.middlewares.use(createSeoMiddleware(filesFor(new Date())))
    },
    generateBundle() {
      if (adsenseClient !== null && buildAdsTxt(adsenseClient) === null) {
        this.warn('The AdSense client id is malformed (expected ca-pub-…), so ads.txt was not generated')
      }
      for (const file of filesFor(new Date())) {
        this.emitFile({ type: 'asset', fileName: file.fileName, source: file.source })
      }
    },
  }
}
