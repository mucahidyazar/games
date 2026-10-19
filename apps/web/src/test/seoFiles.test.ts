// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { PORTAL, siteById } from '../sites/sites'
import { pageSeoFor, seoFor, staticPagesFor, type PageSeo } from '../sites/seo'
import type {
  IndexHtmlTransformContext,
  MinimalPluginContextWithoutEnvironment,
  Plugin,
  Rolldown,
  ViteDevServer,
} from 'vite'
import {
  buildAdsTxt,
  buildRobotsTxt,
  buildSeoFiles,
  buildSitemapXml,
  createSeoMiddleware,
  fillPageHead,
  fillSiteUrl,
  fillSiteHtml,
  normalizeSiteUrl,
  pageFileName,
  renderPageHead,
  seoFiles,
  staticPageAt,
  type DevResponse,
  type SeoMiddleware,
} from '../../vite-plugins/seoFiles'

const SITE_URL = 'https://traptheorb.com'
const CLIENT = 'ca-pub-1234567890123456'
const BUILD_DATE = new Date('2026-09-23T21:45:00Z')
const INDEX_HTML = readFileSync(new URL('../../index.html', import.meta.url), 'utf8')
/** What Vite adds to index.html in a build. */
const APP_SCRIPT = '<script type="module" crossorigin src="/assets/index-abc123.js"></script>'
/** The portal's pages besides its home, each written as its own file. */
const PORTAL_PAGES = ['about.html', 'profile.html', 'trap-the-orb.html', 'trap-the-orb/leaderboards.html', 'absurd-trolley-problems.html']

function handlerOf<T>(hook: T | { readonly handler: T } | undefined): T {
  if (hook === undefined) throw new Error('hook is not defined')
  return typeof hook === 'object' && hook !== null && 'handler' in hook ? hook.handler : hook
}

interface FakeResponse extends DevResponse {
  readonly headers: Record<string, string>
  body: string | undefined
  ended: boolean
}

function fakeResponse(): FakeResponse {
  const response: FakeResponse = {
    statusCode: 0,
    headers: {},
    body: undefined,
    ended: false,
    setHeader(name, value) {
      response.headers[name.toLowerCase()] = value
    },
    end(body) {
      response.body = body
      response.ended = true
    },
  }
  return response
}

interface BundleRun {
  readonly emitted: readonly Rolldown.EmittedFile[]
  readonly warnings: readonly string[]
}

/** Runs the plugin's index.html transform, as Vite does for the page it serves (`originalUrl`) or builds. */
async function transformIndex(plugin: Plugin, originalUrl?: string): Promise<string> {
  const context = { path: '/index.html', filename: '/index.html', originalUrl } as IndexHtmlTransformContext
  const html = await handlerOf(plugin.transformIndexHtml).call({} as MinimalPluginContextWithoutEnvironment, INDEX_HTML, context)
  if (typeof html !== 'string') throw new Error('the transform should return the HTML')
  return html
}

/** Runs generateBundle on a bundle holding index.html as Vite builds it, unless another bundle is given. */
async function runGenerateBundle(plugin: Plugin, bundle?: Record<string, unknown>): Promise<BundleRun> {
  const emitted: Rolldown.EmittedFile[] = []
  const warnings: string[] = []
  const context = {
    emitFile(file: Rolldown.EmittedFile): string {
      emitted.push(file)
      return `ref-${emitted.length}`
    },
    warn(message: string): void {
      warnings.push(message)
    },
  }
  const outputOptions = {} as Rolldown.NormalizedOutputOptions
  const built = bundle ?? {
    'index.html': { type: 'asset', fileName: 'index.html', source: (await transformIndex(plugin)).replace('</head>', `  ${APP_SCRIPT}\n  </head>`) },
  }

  await handlerOf(plugin.generateBundle).call(context as unknown as Rolldown.PluginContext, outputOptions, built as unknown as Rolldown.OutputBundle, true)
  return { emitted, warnings }
}

/** Type and size from a PNG's header chunk or a JPEG's start-of-frame segment. */
function imageSize(bytes: Buffer): { type: string; width: number; height: number } | null {
  if (bytes.readUInt32BE(0) === 0x89504e47) return { type: 'image/png', width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
  if (bytes.readUInt16BE(0) !== 0xffd8) return null
  for (let offset = 2; offset + 9 < bytes.length; offset += 2 + bytes.readUInt16BE(offset + 2)) {
    const marker = bytes.readUInt16BE(offset)
    // SOF0–SOF15 carry the size; C4, C8 and CC in that range are other segments.
    if (marker >= 0xffc0 && marker <= 0xffcf && ![0xffc4, 0xffc8, 0xffcc].includes(marker)) {
      return { type: 'image/jpeg', width: bytes.readUInt16BE(offset + 7), height: bytes.readUInt16BE(offset + 5) }
    }
  }
  return null
}

async function registerDevMiddleware(plugin: Plugin): Promise<SeoMiddleware> {
  const use = vi.fn<(middleware: SeoMiddleware) => void>()
  const server = { middlewares: { use } } as unknown as ViteDevServer

  await handlerOf(plugin.configureServer).call({} as MinimalPluginContextWithoutEnvironment, server)

  const middleware = use.mock.calls[0]?.[0]
  if (!middleware) throw new Error('no middleware was registered')
  return middleware
}

describe('normalizeSiteUrl', () => {
  it('removes trailing slashes, the query string and the fragment', () => {
    expect(normalizeSiteUrl('https://traptheorb.com/')).toBe(SITE_URL)
    expect(normalizeSiteUrl(' https://example.com/games//?a=1#top ')).toBe('https://example.com/games')
  })

  it.each(['', 'traptheorb.com', '/games', 'ftp://traptheorb.com', 'javascript:alert(1)'])(
    'rejects %j because it is not an absolute http(s) URL',
    (value) => {
      expect(() => normalizeSiteUrl(value)).toThrow(/absolute http\(s\) URL/)
    },
  )
})

describe('buildRobotsTxt', () => {
  it('allows every crawler and points to the sitemap', () => {
    expect(buildRobotsTxt(`${SITE_URL}/`)).toBe(
      ['User-agent: *', 'Allow: /', '', 'Sitemap: https://traptheorb.com/sitemap.xml', ''].join('\n'),
    )
  })
})

describe('buildSitemapXml', () => {
  it('lists the standalone game and its leaderboard with the build date', () => {
    const xml = buildSitemapXml(SITE_URL, BUILD_DATE, seoFor(siteById('traptheorb')).sitemap)

    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n')).toBe(true)
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    expect(xml.match(/<url>/g)).toHaveLength(3)
    expect(xml).toContain('<loc>https://traptheorb.com/</loc>')
    expect(xml).toContain('<loc>https://traptheorb.com/about</loc>')
    expect(xml).toContain('<loc>https://traptheorb.com/leaderboards</loc>')
    expect(xml).toContain('<lastmod>2026-09-23</lastmod>')
    expect(xml).toContain('<changefreq>weekly</changefreq>')
    expect(xml).toContain('<priority>1.0</priority>')
  })

  it('lists the portal home, each game landing page and the leaderboards a game has', () => {
    const xml = buildSitemapXml(PORTAL.url, BUILD_DATE)
    expect(xml.match(/<url>/g)).toHaveLength(5)
    expect(xml).toContain('<loc>https://games.mucahid.dev/</loc>')
    expect(xml).toContain('<loc>https://games.mucahid.dev/about</loc>')
    expect(xml).toContain('<loc>https://games.mucahid.dev/trap-the-orb</loc>')
    expect(xml).toContain('<loc>https://games.mucahid.dev/trap-the-orb/leaderboards</loc>')
    expect(xml).toContain('<loc>https://games.mucahid.dev/absurd-trolley-problems</loc>')
    expect(xml).not.toContain('/absurd-trolley-problems/leaderboards')
    expect(xml).not.toContain('/play/')
    expect(xml).not.toContain('/profile')
  })

  it('formats lastmod as the UTC calendar date', () => {
    expect(buildSitemapXml(SITE_URL, new Date('2026-01-05T00:00:00Z'))).toContain('<lastmod>2026-01-05</lastmod>')
  })

  it('escapes XML special characters in the URL', () => {
    expect(buildSitemapXml("https://example.com/a&b'c", BUILD_DATE)).toContain(
      '<loc>https://example.com/a&amp;b&apos;c/</loc>',
    )
  })
})

describe('buildAdsTxt', () => {
  it('declares Google as a direct seller for a valid publisher id', () => {
    expect(buildAdsTxt(CLIENT)).toBe('google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0\n')
    expect(buildAdsTxt(` ${CLIENT} `)).toBe('google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0\n')
  })

  it.each([null, undefined, '', 'pub-1234567890123456', 'ca-pub-123', 'ca-pub-1234567890123456x'])(
    'returns null for %j',
    (value) => {
      expect(buildAdsTxt(value)).toBeNull()
    },
  )
})

describe('buildSeoFiles', () => {
  it('builds robots.txt and sitemap.xml when ads are off', () => {
    const files = buildSeoFiles({ siteUrl: SITE_URL }, BUILD_DATE)

    expect(files.map((file) => file.fileName)).toEqual(['robots.txt', 'sitemap.xml'])
    expect(files[0]?.contentType).toBe('text/plain; charset=utf-8')
    expect(files[1]?.contentType).toBe('application/xml; charset=utf-8')
  })

  it('adds ads.txt for a valid AdSense client', () => {
    const files = buildSeoFiles({ siteUrl: SITE_URL, adsenseClient: CLIENT }, BUILD_DATE)

    expect(files.map((file) => file.fileName)).toEqual(['robots.txt', 'sitemap.xml', 'ads.txt'])
    expect(files[2]?.source).toBe(buildAdsTxt(CLIENT))
  })

  it('skips ads.txt for an invalid AdSense client', () => {
    const files = buildSeoFiles({ siteUrl: SITE_URL, adsenseClient: 'ca-pub-oops' }, BUILD_DATE)

    expect(files.map((file) => file.fileName)).toEqual(['robots.txt', 'sitemap.xml'])
  })
})

describe('fillSiteUrl', () => {
  it('replaces every %VITE_SITE_URL% placeholder', () => {
    const html = '<link rel="canonical" href="%VITE_SITE_URL%/"><meta content="%VITE_SITE_URL%/og-image.png">'

    expect(fillSiteUrl(html, SITE_URL)).toBe(
      '<link rel="canonical" href="https://traptheorb.com/"><meta content="https://traptheorb.com/og-image.png">',
    )
  })

  it('inserts the URL literally, without replacement patterns', () => {
    expect(fillSiteUrl('%VITE_SITE_URL%', 'https://example.com/$&')).toBe('https://example.com/$&amp;')
  })
})

describe('fillSiteHtml', () => {
  it.each([PORTAL, siteById('traptheorb')])('fills all metadata for $id', (site) => {
    const [home] = staticPagesFor(site)
    if (!home) throw new Error('no home page')
    const html = fillPageHead(fillSiteHtml(INDEX_HTML, site, site.url), pageSeoFor(home.route, site))
    expect(html).not.toMatch(/%(?:SITE_|VITE_|NOT_FOUND_|PAGE_)/)
    expect(html).toContain(`<title>${seoFor(site).title}</title>`)
    expect(html).toContain(`href="${site.url}/"`)
    expect(html).toContain(`content="${site.name}"`)
    expect(html).toContain(`href="${seoFor(site).manifest}"`)
    const data = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/)?.[1]
    expect(JSON.parse(data ?? '')).toEqual(seoFor(site).jsonLd(site.url))
  })

  it('escapes attributes', () => {
    const site = { ...PORTAL, name: 'Games " onload="alert(1)' }
    expect(fillSiteHtml('%SITE_NAME%', site, 'https://example.com')).toBe('Games &quot; onload=&quot;alert(1)')
  })
})

describe('page heads', () => {
  const trolley = pageSeoFor({ page: 'play', game: 'absurd-trolley-problems', mode: null }, PORTAL)

  it('carry the page’s own title, canonical URL and link preview', () => {
    const head = renderPageHead(trolley)
    expect(head).toContain('<title>Absurd Trolley Problems — games.mucahid.dev</title>')
    expect(head).toContain('<link rel="canonical" href="https://games.mucahid.dev/absurd-trolley-problems" />')
    expect(head).toContain('<meta property="og:url" content="https://games.mucahid.dev/absurd-trolley-problems" />')
    expect(head).toContain('<meta property="og:title" content="Absurd Trolley Problems — Pull the lever. Or don’t." />')
    expect(head).toContain('<meta property="og:image" content="https://games.mucahid.dev/games/absurd-trolley-problems/cover.png" />')
    expect(head).toContain('<meta property="og:image:type" content="image/png" />')
    expect(head).toContain('<meta name="twitter:image" content="https://games.mucahid.dev/games/absurd-trolley-problems/cover.png" />')
    expect(head).toContain('<meta name="robots" content="index,follow" />')
    expect(head).toMatch(/^<!--page-head-->[\s\S]*<!--\/page-head-->$/)
  })

  it('escape attributes and keep JSON-LD from closing its script element', () => {
    const page: PageSeo = { ...trolley, shareTitle: 'A " onload="alert(1)', jsonLd: { name: '</script><script>alert(1)</script>' } }
    const head = renderPageHead(page)
    expect(head).toContain('content="A &quot; onload=&quot;alert(1)"')
    expect(head.match(/<\/script>/g)).toHaveLength(1)
  })

  it('leave out structured data a page does not have', () => {
    expect(renderPageHead({ ...trolley, jsonLd: null })).not.toContain('application/ld+json')
  })

  it('fill index.html once, and swap in another page’s head afterwards', () => {
    const home = fillPageHead(INDEX_HTML, pageSeoFor({ page: 'home' }, PORTAL))
    const page = fillPageHead(home, trolley)
    expect(page.match(/<!--page-head-->/g)).toHaveLength(1)
    expect(page.match(/<title>/g)).toHaveLength(1)
    expect(page).toContain(renderPageHead(trolley))
    expect(page.replace(renderPageHead(trolley), '')).toBe(home.replace(renderPageHead(pageSeoFor({ page: 'home' }, PORTAL)), ''))
  })

  it('are written to a file named after the path', () => {
    expect(pageFileName('/')).toBe('index.html')
    expect(pageFileName('/about')).toBe('about.html')
    expect(pageFileName('/trap-the-orb/leaderboards')).toBe('trap-the-orb/leaderboards.html')
  })

  it('go to the nearest page that has one, and to the home page when none does', () => {
    const pages = staticPagesFor(PORTAL)
    expect(staticPageAt('/absurd-trolley-problems/', pages).path).toBe('/absurd-trolley-problems')
    expect(staticPageAt('/trap-the-orb/play/daily', pages).path).toBe('/trap-the-orb')
    expect(staticPageAt('/trap-the-orb/leaderboards', pages).path).toBe('/trap-the-orb/leaderboards')
    expect(staticPageAt('/no-such-page', pages).path).toBe('/')
    expect(staticPageAt('/play/zen', staticPagesFor(siteById('traptheorb'))).route).toEqual({ page: 'play', game: 'trap-the-orb', mode: null })
  })
})

describe('link preview images', () => {
  const PUBLIC = new URL('../../public/', import.meta.url)

  it.each([PORTAL, siteById('traptheorb')])('are small 1200 × 630 files of the declared type on every $id page', (site) => {
    for (const { route } of staticPagesFor(site)) {
      const page = pageSeoFor(route, site)
      const file = readFileSync(new URL(`.${new URL(page.image).pathname}`, PUBLIC))
      expect(imageSize(file), page.image).toEqual({ type: page.imageType, width: 1200, height: 630 })
      // Chat apps skip big images (WhatsApp at around 300 KB).
      expect(file.length, page.image).toBeLessThan(300 * 1024)
    }
  })
})

describe('createSeoMiddleware', () => {
  const files = buildSeoFiles({ siteUrl: SITE_URL, adsenseClient: CLIENT }, BUILD_DATE)
  const middleware = createSeoMiddleware(files)

  it.each(['robots.txt', 'sitemap.xml', 'ads.txt'])('serves /%s', (fileName) => {
    const res = fakeResponse()
    const next = vi.fn()

    middleware({ url: `/${fileName}?utm=1`, method: 'GET' }, res, next)

    const file = files.find((candidate) => candidate.fileName === fileName)
    expect(next).not.toHaveBeenCalled()
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toBe(file?.contentType)
    expect(res.body).toBe(file?.source)
  })

  it('answers HEAD requests without a body', () => {
    const res = fakeResponse()

    middleware({ url: '/robots.txt', method: 'HEAD' }, res, vi.fn())

    expect(res.statusCode).toBe(200)
    expect(res.ended).toBe(true)
    expect(res.body).toBeUndefined()
  })

  it.each([
    { url: '/', method: 'GET' },
    { url: '/src/main.tsx', method: 'GET' },
    { url: '/robots.txt', method: 'POST' },
    { url: undefined, method: 'GET' },
  ])('passes $method $url through to the next handler', (req) => {
    const res = fakeResponse()
    const next = vi.fn()

    middleware(req, res, next)

    expect(next).toHaveBeenCalledOnce()
    expect(res.ended).toBe(false)
  })
})

describe('seoFiles plugin', () => {
  it('fails fast on an invalid site URL', () => {
    expect(() => seoFiles({ siteUrl: 'traptheorb.com' })).toThrow(/absolute http\(s\) URL/)
  })

  it('emits robots.txt and sitemap.xml into the bundle', async () => {
    const { emitted, warnings } = await runGenerateBundle(seoFiles({ siteUrl: `${SITE_URL}/` }))

    expect(emitted.map((file) => file.fileName)).toEqual(['robots.txt', 'sitemap.xml', '404.html', ...PORTAL_PAGES])
    expect(emitted.every((file) => file.type === 'asset')).toBe(true)
    expect(emitted[0]).toMatchObject({ source: buildRobotsTxt(SITE_URL) })
    expect(warnings).toEqual([])
  })

  it('also emits ads.txt when the AdSense client is valid', async () => {
    const { emitted } = await runGenerateBundle(seoFiles({ siteUrl: SITE_URL, adsenseClient: CLIENT }))

    expect(emitted.map((file) => file.fileName)).toEqual(['robots.txt', 'sitemap.xml', 'ads.txt', '404.html', ...PORTAL_PAGES])
    expect(emitted[2]).toMatchObject({ source: buildAdsTxt(CLIENT) })
  })

  it('warns instead of emitting ads.txt for a malformed AdSense client', async () => {
    const { emitted, warnings } = await runGenerateBundle(seoFiles({ siteUrl: SITE_URL, adsenseClient: 'pub-123' }))

    expect(emitted.map((file) => file.fileName)).toEqual(['robots.txt', 'sitemap.xml', '404.html', ...PORTAL_PAGES])
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toMatch(/ads\.txt/)
  })

  it.each([PORTAL, siteById('traptheorb')])('writes each $id page its own index.html, with the app’s scripts', async (site) => {
    const { emitted } = await runGenerateBundle(seoFiles({ site, siteUrl: site.url }))
    const pages = staticPagesFor(site).filter((page) => page.path !== '/')
    expect(pages.length).toBeGreaterThan(0)
    for (const page of pages) {
      const file = emitted.find((candidate) => candidate.fileName === pageFileName(page.path))
      const source = file?.type === 'asset' ? String(file.source) : ''
      expect(source, page.path).toContain(renderPageHead(pageSeoFor(page.route, site)))
      expect(source, page.path).toContain(APP_SCRIPT)
      expect(source.match(/<title>/g), page.path).toHaveLength(1)
    }
  })

  it('gives the game pages their own previews in the build', async () => {
    const { emitted } = await runGenerateBundle(seoFiles({ siteUrl: PORTAL.url }))
    const trolley = emitted.find((file) => file.fileName === 'absurd-trolley-problems.html')
    expect(trolley).toMatchObject({ source: expect.stringContaining('<meta property="og:image" content="https://games.mucahid.dev/games/absurd-trolley-problems/cover.png" />') })
    expect(trolley).toMatchObject({ source: expect.stringContaining('<link rel="canonical" href="https://games.mucahid.dev/absurd-trolley-problems" />') })
  })

  it('warns when the bundle has no index.html to copy', async () => {
    const { emitted, warnings } = await runGenerateBundle(seoFiles({ siteUrl: SITE_URL }), {})
    expect(emitted.map((file) => file.fileName)).toEqual(['robots.txt', 'sitemap.xml', '404.html'])
    expect(warnings).toEqual([expect.stringMatching(/index\.html/)])
  })

  it('does not warn when the AdSense client is simply unset', async () => {
    expect((await runGenerateBundle(seoFiles({ siteUrl: SITE_URL, adsenseClient: '' }))).warnings).toEqual([])
    expect((await runGenerateBundle(seoFiles({ siteUrl: SITE_URL, adsenseClient: null }))).warnings).toEqual([])
  })

  it.each([PORTAL, siteById('traptheorb')])('emits the $id branded static 404', async (site) => {
    const { emitted } = await runGenerateBundle(seoFiles({ site, siteUrl: site.url }))
    const page = emitted.find((file) => file.fileName === '404.html')
    expect(page).toMatchObject({ type: 'asset', source: expect.stringContaining(`<title>${seoFor(site).notFound.title}</title>`) })
    expect(page).toMatchObject({ source: expect.stringContaining(seoFor(site).notFound.cta) })
  })

  it('serves the files from the dev server', async () => {
    const middleware = await registerDevMiddleware(seoFiles({ siteUrl: SITE_URL }))
    const res = fakeResponse()

    middleware({ url: '/sitemap.xml', method: 'GET' }, res, vi.fn())

    expect(res.headers['content-type']).toBe('application/xml; charset=utf-8')
    expect(res.body).toContain('<loc>https://traptheorb.com/</loc>')
  })

  it('fills the site URL into index.html before Vite replaces env variables', async () => {
    const hook = seoFiles({ siteUrl: `${SITE_URL}/` }).transformIndexHtml
    const context = { path: '/index.html', filename: '/index.html' } as IndexHtmlTransformContext

    expect(hook).toMatchObject({ order: 'pre' })
    const html = await handlerOf(hook).call(
      {} as MinimalPluginContextWithoutEnvironment,
      '<link rel="canonical" href="%VITE_SITE_URL%/">',
      context,
    )
    expect(html).toBe('<link rel="canonical" href="https://traptheorb.com/">')
  })

  it('fills index.html in as the home page in a build', async () => {
    const html = await transformIndex(seoFiles({ siteUrl: PORTAL.url }))
    expect(html).toContain(renderPageHead(pageSeoFor({ page: 'home' }, PORTAL)))
    expect(html).not.toMatch(/%[A-Z_]+%/)
  })

  it('fills in the head of the page the dev server serves', async () => {
    const plugin = seoFiles({ siteUrl: PORTAL.url })
    expect(await transformIndex(plugin, '/absurd-trolley-problems?ref=chat')).toContain('<title>Absurd Trolley Problems — games.mucahid.dev</title>')
    expect(await transformIndex(plugin, '/trap-the-orb/play/daily')).toContain('<link rel="canonical" href="https://games.mucahid.dev/trap-the-orb" />')
    expect(await transformIndex(plugin, '/no-such-page')).toContain(`<title>${seoFor(PORTAL).title}</title>`)
  })
})
