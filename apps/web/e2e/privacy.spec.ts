import { expect, test } from '@playwright/test'
import { mockApi } from './fakeApi'

test('advertising placements open email inquiries outside the game surface', async ({ page }) => {
  await mockApi(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Only necessary' }).click()
  const placement = page.getByRole('complementary', { name: 'Advertisement', exact: true })
  const link = placement.getByRole('link', { name: 'Advertise here' })
  await expect(link).toBeVisible()
  const href = new URL((await link.getAttribute('href'))!)
  expect(href.protocol).toBe('mailto:')
  expect(href.searchParams.get('subject')).toContain('games.mucahid.dev')
  await link.focus()
  await expect(link).toBeFocused()
  await page.goto('/trap-the-orb/leaderboards')
  await expect(placement.getByRole('link', { name: 'Advertise here' })).toBeVisible()
  await page.goto('/trap-the-orb')
  await expect(placement).toHaveCount(0)
  await expect(page.locator('script[src*="googlesyndication"],ins.adsbygoogle')).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0)
})

test('analytics is opt-in, path-only, and withdrawn through privacy settings', async ({ page }) => {
  await mockApi(page)
  const requests: string[] = []
  await page.route(/googletagmanager\.com|google-analytics\.com|googlesyndication\.com/, async route => {
    requests.push(route.request().url())
    await route.fulfill({ status: 200, contentType: 'application/javascript', body: '' })
  })
  await page.goto('/?private=test-value#private-fragment')
  await expect(page.getByRole('complementary', { name: 'Privacy choices' })).toBeVisible()
  expect(requests).toEqual([])
  await page.getByRole('button', { name: 'Allow analytics', exact: true }).click()
  await expect(page.locator('#games-gtm-js')).toHaveCount(1)
  const views = () => page.evaluate(() => {
    const queue = Reflect.get(window, 'dataLayer') as { event?: string }[]
    return queue.filter(entry => entry.event === 'site_page_view')
  })
  expect(await views()).toEqual([{
    event: 'site_page_view', page_path: '/', page_location: `${new URL(page.url()).origin}/`, page_referrer: '',
  }])
  await page.getByRole('navigation', { name: 'Site links' }).getByRole('link', { name: 'About', exact: true }).click()
  await expect(page).toHaveURL('/about')
  await expect.poll(async () => (await views()).length).toBe(2)
  expect(requests.filter(url => url.includes('/gtm.js'))).toHaveLength(1)
  await page.getByRole('button', { name: 'Privacy settings', exact: true }).click()
  await page.getByRole('dialog', { name: 'Privacy settings' }).getByRole('button', { name: 'Only necessary' }).click()
  await expect(page.locator('#games-gtm-js')).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.locator('#games-gtm-js')).toHaveCount(0)
  expect(requests.filter(url => url.includes('/gtm.js'))).toHaveLength(1)
})

test('necessary-only choice is keyboard accessible and never overlays game controls afterward', async ({ page }) => {
  await mockApi(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/trap-the-orb')
  await page.getByRole('button', { name: 'Only necessary' }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('complementary', { name: 'Privacy choices' })).toBeHidden()
  await page.getByRole('button', { name: 'Play Classic' }).click()
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0)
  await expect(page.locator('script[src*="googletagmanager"],script[src*="googlesyndication"]')).toHaveCount(0)
})
