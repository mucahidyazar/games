import { readFile } from 'node:fs/promises'
import { expect, test as base, type Page } from '@playwright/test'
import * as z from 'zod/mini'
import { mockApi } from './fakeApi.ts'

/**
 * Runs the production build under the Content-Security-Policy from vercel.json.
 * `vite preview` sends no security headers, so the policy is attached to every HTML
 * document here, the way Vercel (vercel.json) and Netlify / Cloudflare Pages
 * (public/_headers) serve it.
 */

/** A fixed seed keeps orb positions identical between runs. */
const GAME_URL = '/trap-the-orb?seed=42'
/** Chromium and WebKit log "Content Security Policy"; Firefox logs "Content-Security-Policy". */
const CSP_CONSOLE_MESSAGE = /content[- ]security[- ]policy/i
/** `route.fetch()` hands back the decoded body, so headers describing the compressed transfer must go. */
const TRANSFER_HEADERS = new Set(['content-encoding', 'content-length', 'transfer-encoding'])
/**
 * Directives that cannot work over plain HTTP. WebKit applies `upgrade-insecure-requests` even to
 * 127.0.0.1, so every asset request would go to https:// and fail against `vite preview`. The live
 * site is HTTPS-only, where the directive changes nothing for its own requests.
 */
const HTTPS_ONLY_DIRECTIVES = new Set(['upgrade-insecure-requests'])
/** Built HTML files that must work without inline code. */
const BUILT_PAGES = ['dist/index.html', 'dist/404.html'] as const

const VercelConfigSchema = z.object({
  headers: z.array(
    z.object({
      source: z.string(),
      headers: z.array(z.object({ key: z.string(), value: z.string() })),
    }),
  ),
})

const projectFile = (path: string): URL => new URL(`../${path}`, import.meta.url)

/** The policy vercel.json sends for every path — read at test time so this test follows the deployed policy. */
async function readProductionPolicy(): Promise<string> {
  const config = VercelConfigSchema.parse(JSON.parse(await readFile(projectFile('vercel.json'), 'utf8')))
  const policy = config.headers
    .find((rule) => rule.source === '/(.*)')
    ?.headers.find((header) => header.key.toLowerCase() === 'content-security-policy')?.value
  if (!policy) throw new Error('vercel.json sends no Content-Security-Policy for "/(.*)"')
  return policy
}

/** The production policy as it can be served from `origin`: HTTPS-only directives are dropped for http:. */
function policyFor(origin: URL, productionPolicy: string): string {
  if (origin.protocol !== 'http:') return productionPolicy
  return productionPolicy
    .split(';')
    .map((directive) => directive.trim())
    .filter((directive) => directive !== '' && !HTTPS_ONLY_DIRECTIVES.has(directive.split(/\s+/)[0]?.toLowerCase() ?? ''))
    .join('; ')
}

/** Serves every HTML document from the preview server with the policy, like the production host. */
async function sendPolicyWithDocuments(page: Page, origin: string, policy: string): Promise<void> {
  await page.route(
    (url) => url.origin === origin,
    async (route) => {
      if (route.request().resourceType() !== 'document') {
        await route.fallback()
        return
      }
      const response = await route.fetch()
      const headers = Object.fromEntries(
        Object.entries(response.headers()).filter(([name]) => !TRANSFER_HEADERS.has(name.toLowerCase())),
      )
      await route.fulfill({ response, headers: { ...headers, 'content-security-policy': policy } })
    },
  )
}

type ViolationWindow = Window & { __cspViolations?: string[] }

/** Init script: records every `securitypolicyviolation` the document reports. Runs before any page script. */
function recordViolations(): void {
  const violations: string[] = []
  Object.defineProperty(window, '__cspViolations', { value: violations })
  document.addEventListener(
    'securitypolicyviolation',
    (event) => {
      const blocked = event.blockedURI || 'inline code'
      violations.push(`${event.effectiveDirective} blocked ${blocked} (${event.sourceFile || 'document'}:${event.lineNumber})`)
    },
    { capture: true },
  )
}

function readRecordedViolations(): string[] {
  const violations = (window as ViolationWindow).__cspViolations
  if (!violations) throw new Error('The CSP violation recorder is missing from this document')
  return [...violations]
}

/**
 * Inline code that a policy without 'unsafe-inline' blocks: inline <script> elements (JSON-LD data
 * blocks excepted), on* event handler attributes and javascript: URLs. Parsed with the browser's
 * DOMParser, which never runs scripts.
 */
function findInlineCode(page: Page, html: string): Promise<string[]> {
  return page.evaluate((source) => {
    const dataScriptTypes = new Set(['application/ld+json'])
    const urlAttributes = new Set(['href', 'src', 'action', 'formaction', 'xlink:href'])
    const doc = new DOMParser().parseFromString(source, 'text/html')
    const found: string[] = []

    for (const script of doc.querySelectorAll('script')) {
      const type = (script.getAttribute('type') ?? '').trim().toLowerCase()
      if (!script.hasAttribute('src') && !dataScriptTypes.has(type)) {
        found.push(`inline <script${type ? ` type="${type}"` : ''}>: ${script.textContent?.trim().slice(0, 60) ?? ''}`)
      }
    }
    for (const element of doc.querySelectorAll('*')) {
      for (const { name, value } of element.attributes) {
        if (name.startsWith('on')) found.push(`${name}="…" on <${element.localName}>`)
        if (urlAttributes.has(name) && /^\s*javascript:/i.test(value)) found.push(`javascript: URL in <${element.localName} ${name}>`)
      }
    }
    return found
  }, html)
}

type CspFixture = {
  /** The policy from vercel.json (minus HTTPS-only directives on http:), sent with every HTML document. */
  readonly policy: string
  /** Violations reported by the current document, plus CSP errors logged to the console. */
  readonly violations: () => Promise<string[]>
}

const test = base.extend<{ csp: CspFixture }>({
  // Playwright's `use` callback is named `provide`: oxlint's React hook rules would flag a call to `use(…)`.
  csp: async ({ page, baseURL }, provide) => {
    if (!baseURL) throw new Error('The CSP tests need `use.baseURL` in playwright.config.ts')
    const origin = new URL(baseURL)
    const policy = policyFor(origin, await readProductionPolicy())
    const consoleErrors: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error' && CSP_CONSOLE_MESSAGE.test(message.text())) consoleErrors.push(message.text())
    })
    await page.addInitScript(recordViolations)
    await mockApi(page)
    await sendPolicyWithDocuments(page, origin.origin, policy)

    await provide({
      policy,
      violations: async () => [...(await page.evaluate(readRecordedViolations)), ...consoleErrors],
    })
  },
})

test.describe('Content Security Policy', () => {
  test('is enforced, so a violation cannot go unnoticed', async ({ page, csp }) => {
    const response = await page.goto(GAME_URL)
    expect(response?.headers()['content-security-policy']).toBe(csp.policy)

    const inlineScriptRan = await page.evaluate(() => {
      const script = document.createElement('script')
      script.textContent = 'window.__inlineScriptRan = true'
      document.head.append(script)
      return (window as Window & { __inlineScriptRan?: boolean }).__inlineScriptRan === true
    })

    expect(inlineScriptRan).toBe(false)
    await expect.poll(csp.violations).toContainEqual(expect.stringContaining('script-src'))
  })

  test('lets the game start, build a wall and open a dialog without violations', async ({ page, csp }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))

    await page.goto(GAME_URL)
    await page.getByRole('button', { name: 'Play Classic' }).click()
    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible()

    const box = await page.locator('canvas').boundingBox()
    if (!box) throw new Error('canvas has no size')
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5)

    // Same-document hash navigation, like the header link: loads the lazy dialog chunk under the policy.
    await page.goto(`${GAME_URL}#how-to-play`)
    await expect(page.getByRole('heading', { name: 'How to play' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Controls' })).toBeVisible()

    expect(await csp.violations()).toEqual([])
    expect(errors).toEqual([])
  })

  test('lets the 404 page render without violations', async ({ page, csp }) => {
    const response = await page.goto('/404.html')
    expect(response?.headers()['content-security-policy']).toBe(csp.policy)

    await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible()
    expect(await csp.violations()).toEqual([])
  })

  test('built pages contain no inline code the policy would block', async ({ page }) => {
    for (const file of BUILT_PAGES) {
      const html = await readFile(projectFile(file), 'utf8').catch((error: unknown) => {
        throw new Error(`${file} is missing — run \`pnpm build\` first`, { cause: error })
      })
      expect(await findInlineCode(page, html), file).toEqual([])
    }
  })

  test('public/_headers sends the same policy as vercel.json', async () => {
    const headersFile = await readFile(projectFile('public/_headers'), 'utf8')
    const prefix = 'content-security-policy:'
    const line = headersFile
      .split('\n')
      .map((entry) => entry.trim())
      .find((entry) => entry.toLowerCase().startsWith(prefix))

    expect(line?.slice(prefix.length).trim()).toBe(await readProductionPolicy())
  })
})
