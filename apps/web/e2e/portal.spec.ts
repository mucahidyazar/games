import { expect, test } from '@playwright/test'
import { mockApi } from './fakeApi.ts'

test.beforeEach(async ({ page }) => {
  await mockApi(page)
})

test('keeps the selected theme across the portal, game, dialogs and About', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: /Play in seconds/ })).toBeVisible()
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(11, 22, 48)')

  await page.getByRole('link', { name: 'Play Trap The Orb', exact: true }).first().click()
  await expect(page).toHaveURL('/trap-the-orb')
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(11, 22, 48)')
  await expect(page.getByRole('dialog', { name: 'The original challenge' })).toHaveCSS('background-color', 'rgb(19, 35, 62)')

  await page.getByRole('link', { name: 'Sign in', exact: true }).click()
  const account = page.getByRole('dialog', { name: 'Your account' })
  await expect(account).toHaveCSS('background-color', 'rgb(19, 35, 62)')
  await expect(account.getByLabel('Email')).toHaveCSS('background-color', 'rgb(19, 35, 62)')
  await account.getByRole('button', { name: 'Close dialog' }).click()
  await expect(account).toBeHidden()

  await page.getByRole('button', { name: 'Switch to Light theme' }).click()
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(249, 250, 252)')
  await expect(page.getByRole('dialog', { name: 'The original challenge' })).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  await page.reload()
  await expect(page.getByRole('button', { name: 'Switch to Navy Dark theme' })).toBeVisible()

  await page.getByRole('contentinfo').getByRole('link', { name: 'About', exact: true }).click()
  await expect(page).toHaveURL('/about')
  await expect(page.getByRole('heading', { level: 1, name: 'About games.mucahid.dev' })).toBeVisible()
  await expect(page.locator('dialog[open]')).toHaveCount(0)
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(249, 250, 252)')
  await page.getByRole('button', { name: 'Switch to Navy Dark theme' }).click()
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(11, 22, 48)')
  await expect(page.locator('.prose-dialog')).toHaveCSS('background-color', 'rgb(19, 35, 62)')
})

test('has usable category empty states and restores the full library', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Scroll to explore' }).click()
  await expect(page).toHaveURL('/#games')
  await expect(page.getByRole('heading', { name: 'Find your next favourite' })).toBeInViewport()
  await page.getByRole('link', { name: 'Puzzle 0', exact: true }).click()
  await expect(page.getByText('No puzzle games yet')).toBeVisible()
  await page.getByRole('link', { name: 'Show all games' }).click()
  await expect(page.getByText('No puzzle games yet')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'One day. One shot.' })).toBeVisible()
})

test('fits small screens, respects reduced motion and closes the menu with Escape', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.locator('.animate-float')).toHaveCSS('animation-name', 'none')
  const menu = page.getByRole('button', { name: 'Open menu' })
  await menu.click()
  await expect(page.getByRole('button', { name: 'Close menu' })).toHaveAttribute('aria-expanded', 'true')
  await page.keyboard.press('Escape')
  await expect(menu).toBeFocused()
  await expect(menu).toHaveAttribute('aria-expanded', 'false')

  for (const path of ['/', '/about', '/trap-the-orb', '/missing-page']) {
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
  }
  const bottomGap = await page.getByRole('contentinfo').evaluate((footer) => {
    return document.documentElement.scrollHeight - (footer.getBoundingClientRect().bottom + window.scrollY)
  })
  expect(Math.abs(bottomGap)).toBeLessThanOrEqual(1)
})

test('the static fallback remembers the theme and legacy About links open the page', async ({ page }) => {
  await page.goto('/#about')
  await expect(page).toHaveURL('/about')
  await expect(page.getByRole('heading', { level: 1, name: 'About games.mucahid.dev' })).toBeVisible()
  await page.getByRole('button', { name: 'Switch to Light theme' }).click()
  await page.goto('/404.html')
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(249, 250, 252)')
  await page.getByRole('link', { name: 'Browse games' }).click()
  await expect(page.getByRole('button', { name: 'Switch to Navy Dark theme' })).toBeVisible()
})
