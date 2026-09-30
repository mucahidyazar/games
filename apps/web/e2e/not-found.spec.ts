import { expect, test } from '@playwright/test'
import { mockApi } from './fakeApi.ts'

/**
 * The generated static 404 page (dist/404.html). Production hosts serve it for unknown paths;
 * `vite preview` falls back to index.html instead, so the tests open it directly.
 */
const NOT_FOUND_URL = '/404.html'

test.describe('404 page', () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page)
  })

  test('explains what happened and links back to the portal', async ({ page }) => {
    await page.goto(NOT_FOUND_URL)

    await expect(page).toHaveTitle('Page not found — games.mucahid.dev')
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex')
    await expect(page.getByRole('banner').getByRole('link', { name: 'games.mucahid.dev' })).toHaveAttribute('href', '/')
    await expect(page.getByText('Error 404 · Page not found')).toBeVisible()
    await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible()
    await expect(page.getByRole('main').getByRole('link', { name: 'Browse games' })).toHaveAttribute('href', '/')
    // The production CSP blocks inline scripts, and the page must not depend on any.
    await expect(page.locator('script:not([src])')).toHaveCount(0)
    await expect(page.locator('script[src="/theme-init.js"]')).toHaveCount(1)
  })

  test('fits a 320px screen without scrolling sideways', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 })
    await page.goto(NOT_FOUND_URL)

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(0)
    await expect(page.getByRole('link', { name: 'Browse games' })).toBeInViewport()
  })

  test('"Browse games" opens the portal', async ({ page }) => {
    await page.goto(NOT_FOUND_URL)
    await page.getByRole('link', { name: 'Browse games' }).click()

    await expect(page).toHaveURL('/')
    await expect(page.getByRole('heading', { level: 1, name: /play in seconds/i })).toBeVisible()
  })
})
