import { expect, test, type Page } from '@playwright/test'
import { mockApi } from './fakeApi.ts'

const GAME_URL = '/absurd-trolley-problems'

/** Waits for the 3D scene to start, or to say it can't (no WebGL); returns which. */
async function sceneStatus(page: Page): Promise<string> {
  const stage = page.locator('.atp-stage')
  await expect(stage).toHaveAttribute('data-status', /ready|error/, { timeout: 60_000 })
  return (await stage.getAttribute('data-status')) ?? 'error'
}

/** Gets past "who's playing?" by starting a first game under the suggested name, then picks the problems. */
async function startGame(page: Page, { set = 'Absurd dilemmas', label = 'Start' } = {}): Promise<void> {
  await page.getByRole('button', { name: label, exact: true }).click()
  await page.getByRole('button', { name: set, exact: true }).click()
}

/** Sweeps the pointer over the scene's lower left, where the lever stands, until the cursor says it can be grabbed. */
async function findLever(page: Page): Promise<{ x: number; y: number } | null> {
  const canvas = page.locator('canvas.atp-canvas')
  const box = await canvas.boundingBox()
  if (!box) return null
  for (let y = 0.4; y <= 0.85; y += 0.05) {
    for (let x = 0.08; x <= 0.44; x += 0.035) {
      const point = { x: box.x + box.width * x, y: box.y + box.height * y }
      await page.mouse.move(point.x, point.y)
      if ((await canvas.evaluate((element) => element.style.cursor)) === 'grab') return point
    }
  }
  return null
}

test.describe('Absurd Trolley Problems', () => {
  // Without a GPU, browsers draw the scene in software: one page at a time, and patiently.
  test.describe.configure({ mode: 'default', timeout: 120_000 })

  test('swaps in its own header, tabs dead centre, over a scene most of the screen tall', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await mockApi(page)
    await page.goto(GAME_URL)

    await expect(page).toHaveTitle(/Absurd Trolley Problems/)
    await expect(page.getByRole('heading', { level: 1, name: 'Absurd Trolley Problems' })).toBeVisible()
    await expect(page.getByRole('banner')).toHaveCount(1)
    await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0)
    await expect(page.getByRole('banner').getByRole('link', { name: 'All games' })).toBeVisible()
    const tabs = await page.getByRole('tablist', { name: 'Game sections' }).boundingBox()
    const viewport = page.viewportSize()
    if (!tabs || !viewport) throw new Error('no layout')
    expect(Math.abs(tabs.x + tabs.width / 2 - viewport.width / 2)).toBeLessThanOrEqual(1)
    const stage = await page.locator('.atp-stage').boundingBox()
    expect(stage?.height ?? 0).toBeGreaterThanOrEqual(viewport.height * 0.6 - 1)
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
    await expect(page.getByRole('heading', { level: 2, name: /Who’s playing\?/ })).toBeVisible()
    await sceneStatus(page)
    expect(errors).toEqual([])
  })

  test('plays a dilemma and shows how everyone else voted', async ({ page }) => {
    const api = await mockApi(page)
    await page.goto(GAME_URL)
    await sceneStatus(page)
    await startGame(page)

    await page.getByRole('button', { name: 'Pull the lever' }).click()

    await expect(page.getByText('64% of the community pulled the lever.')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole('button', { name: /Next dilemma/ })).toBeEnabled()
    await expect(page.getByLabel('Kill count: 1')).toBeVisible()
    await expect(page.getByRole('complementary', { name: 'Research' })).toContainText('Moral Machine')
    expect(api.trolleyVotes).toEqual([expect.objectContaining({ dilemmaId: 'influencers-vs-last-cat', choice: 'pull' })])

    await page.getByRole('button', { name: /Next dilemma/ }).click()
    await expect(page.getByRole('heading', { level: 2, name: /The classic: 5 people or 1\?/ })).toBeVisible()
    await expect(page.getByLabel('Dilemma 2 / 12')).toBeVisible()
  })

  test('pulls the lever by dragging it across the scene', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Finds the lever by its mouse cursor')
    const api = await mockApi(page)
    await page.goto(GAME_URL)
    test.skip((await sceneStatus(page)) !== 'ready', 'This browser has no WebGL')
    await startGame(page)

    const lever = await findLever(page)
    if (!lever) throw new Error('The lever could not be found in the scene')
    await expect(page.locator('canvas.atp-canvas')).toHaveCSS('cursor', 'grab')
    await page.mouse.down()
    await page.mouse.move(lever.x + 160, lever.y - 30, { steps: 10 })
    await page.mouse.up()

    await expect(page.getByRole('button', { name: 'Pull the lever' })).toHaveAttribute('aria-pressed', 'true')
    await expect.poll(() => api.trolleyVotes.map((vote) => vote.choice)).toEqual(['pull'])
  })

  test('speaks Turkish from its own header', async ({ page }) => {
    await mockApi(page)
    await page.goto(GAME_URL)

    await page.getByRole('banner').getByRole('button', { name: 'TR' }).click()
    await expect(page.getByRole('heading', { level: 2, name: /Kim oynuyor\?/ })).toBeVisible()
    await page.getByRole('button', { name: 'Başla', exact: true }).click()
    await expect(page.getByRole('heading', { level: 2, name: /Hangi problemler\?/ })).toBeVisible()
    await page.getByRole('button', { name: 'Absürt ikilemler', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Kolu çek' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'İkilemler' })).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('lang', 'tr')
    // A new visit asks again, and the player carries on where they were.
    await page.reload()
    await page.getByRole('button', { name: 'Oyuncu 1 olarak devam et' }).click()
    await page.getByRole('button', { name: 'Absürt ikilemler', exact: true }).click()
    await expect(page.getByRole('heading', { level: 2, name: /5 influencer mı, son kedi mi\?/ })).toBeVisible()
  })

  test('plays Philippa Foot’s cases in motion, with her answer and the community’s vote', async ({ page }) => {
    const api = await mockApi(page)
    await page.goto(GAME_URL)
    await startGame(page, { set: 'The original problems' })

    await expect(page.getByRole('img', { name: /Animated drawing: the tram/ })).toBeVisible()
    await expect(page.getByText('Philippa Foot · 1967 · Case 1 of 21')).toBeVisible()
    await page.getByRole('button', { name: 'Steer away' }).click()
    const foot = page.getByRole('complementary', { name: 'What would Foot say?' })
    await expect(foot).toContainText('You chose the same.', { timeout: 20_000 })
    await expect(page.getByLabel('Victim count: 1')).toBeVisible()
    await expect.poll(() => api.trolleyVotes.map((vote) => vote.dilemmaId)).toEqual(['foot-driver'])

    await page.getByRole('button', { name: /Next case/ }).click()
    await expect(page.getByRole('img', { name: /Animated drawing: the courthouse/ })).toBeVisible()
    await page.getByRole('banner').getByRole('tab', { name: 'Cases' }).click()
    await expect(page.getByRole('region', { name: 'The essay’s other cases' }).getByRole('listitem')).toHaveCount(3)
  })
})
