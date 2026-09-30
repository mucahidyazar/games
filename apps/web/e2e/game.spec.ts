import { expect, test, type Page } from '@playwright/test'
import { mockApi } from './fakeApi.ts'

/** A fixed seed keeps the ready-screen orbs identical between runs. */
const GAME_URL = '/trap-the-orb?seed=42'

const board = (page: Page) => page.getByRole('application', { name: 'Trap The Orb playing field' })
const status = (page: Page) => page.getByRole('group', { name: 'Game status' })

/** Picks a mode in the start menu; on narrow boards the list first unfolds behind "Change". */
async function pickMode(page: Page, name: RegExp): Promise<void> {
  const toggle = page.getByRole('button', { name: /^Change mode/ })
  if (await toggle.isVisible()) await toggle.click()
  await page.getByRole('navigation', { name: 'Game modes' }).getByRole('link', { name }).click()
}

/** Clicks the middle of the playing field. */
async function clickField(page: Page): Promise<void> {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas has no size')
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5)
}

test.describe('Trap The Orb', () => {
  test('loads straight into a playable level', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await mockApi(page)

    await page.goto(GAME_URL)

    await expect(page).toHaveTitle(/Trap The Orb/)
    await expect(page.getByRole('heading', { level: 1, name: /trap the orb/i })).toBeVisible()
    await expect(page.getByRole('heading', { level: 2, name: 'Level 1' })).toBeVisible()
    await expect(board(page)).toBeVisible()
    await expect(status(page).getByLabel('Fastest orb 1.00×, calm')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible()
    // Production builds never show the "Your ad here" placeholder: without AdSense settings the slot
    // renders nothing, and with them it holds the real ad unit.
    await expect(page.getByText('Your ad here')).toHaveCount(0)
    await expect(page.getByText('Google Play')).toBeVisible()
    await expect(page.getByRole('region', { name: 'Leaderboard' }).getByText('GridMaster')).toBeVisible()
    expect(errors).toEqual([])
  })

  test('fits the field to the screen: wide on desktop, tall on a phone held upright', async ({ page }) => {
    await mockApi(page)
    await page.goto(GAME_URL)

    const box = await page.locator('canvas').boundingBox()
    const viewport = page.viewportSize()
    if (!box || !viewport) throw new Error('no layout')
    if (viewport.height > viewport.width) expect(box.height).toBeGreaterThan(box.width)
    else expect(box.width).toBeGreaterThan(box.height)
  })

  test('starts a guest run, builds a wall and pauses', async ({ page }) => {
    await mockApi(page)
    await page.goto(GAME_URL)
    await expect(page.getByText(/playing as a guest/i)).toBeVisible()
    await page.getByRole('button', { name: 'Play Classic' }).click()
    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible()

    await clickField(page)
    await expect(status(page).getByText(/^00:0[1-9]$/)).toBeVisible()

    await page.keyboard.press('p')
    await expect(page.getByRole('dialog', { name: 'Paused' })).toBeVisible()
    await page.getByRole('dialog', { name: 'Paused' }).getByRole('button', { name: 'Resume' }).click()
    await expect(page.getByRole('dialog', { name: 'Paused' })).toBeHidden()
  })

  test('plays a ranked run that the server verifies', async ({ page }) => {
    const api = await mockApi(page, { signedIn: true })
    await page.goto(GAME_URL)
    await expect(page.getByText('Ranked as Luna — this run counts.')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Your profile: Luna' })).toBeVisible()

    await page.getByRole('button', { name: 'Play Classic' }).click()
    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible()
    const viewport = page.viewportSize()
    const field = viewport && viewport.height > viewport.width ? 'portrait' : 'landscape'
    expect(api.startedRuns).toEqual([{ mode: 'classic', field }])

    await clickField(page)
    await page.getByRole('button', { name: 'End run' }).click()
    await page.getByRole('dialog', { name: 'Paused' }).getByRole('button', { name: 'End run' }).click()

    await expect(page.getByText('Run ended · Classic')).toBeVisible()
    await expect(page.getByRole('region', { name: 'New personal bests' })).toContainText('#3')
    await expect(page.getByRole('img', { name: 'Tight Squeeze, Bronze' })).toBeVisible()
    expect(api.finishedRuns).toHaveLength(1)
    const [finished] = api.finishedRuns
    expect(finished?.runId).toBe('run-1')
    expect(finished?.body).toMatchObject({ clientLevel: 1, endTick: expect.any(Number) })
    expect(finished?.body.inputs).toEqual([
      expect.objectContaining({ t: expect.any(Number), c: expect.any(Number), r: expect.any(Number), o: 'v' }),
    ])
  })

  test('picks a mode from the start menu', async ({ page }) => {
    await mockApi(page)
    await page.goto(GAME_URL)

    await pickMode(page, /Time Attack/)

    await expect(page).toHaveURL('/trap-the-orb/play/timeAttack')
    await expect(page.getByRole('heading', { name: 'Beat the countdown' })).toBeVisible()
    await expect(status(page).getByText('Left')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Play Time Attack' })).toBeInViewport()
  })

  test('sets up Custom in the start menu, with Play in reach', async ({ page }) => {
    await mockApi(page)
    await page.goto(GAME_URL)

    await pickMode(page, /Custom/)
    const menu = page.getByRole('dialog', { name: 'Set up your game' })
    await menu.getByRole('button', { name: 'Expert' }).click()
    await expect(page.getByText('8 orbs · clear at 85%')).toBeVisible()

    const play = menu.getByRole('button', { name: 'Play Custom' })
    await play.scrollIntoViewIfNeeded()
    await expect(play).toBeInViewport()
    await play.click()
    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible()
  })

  test('leaves a practice run for another mode from the pause card', async ({ page }) => {
    await mockApi(page)
    await page.goto('/trap-the-orb/play/zen?seed=42')
    await page.getByRole('button', { name: 'Play Zen' }).click()
    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible()

    await page.getByRole('button', { name: 'Pause' }).click()
    await page.getByRole('dialog', { name: 'Paused' }).getByRole('button', { name: 'Change mode' }).click()
    await pickMode(page, /Hardcore/)

    await expect(page).toHaveURL('/trap-the-orb/play/hardcore')
    await expect(page.getByRole('heading', { name: 'One life. That’s it.' })).toBeVisible()
  })

  test('shows the leaderboards on their own page and keeps the run', async ({ page }) => {
    await mockApi(page)
    await page.goto(GAME_URL)
    await page.getByRole('button', { name: 'Play Classic' }).click()
    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible()

    await page.getByRole('region', { name: 'Leaderboard' }).getByRole('link', { name: 'See all' }).click()
    await expect(page).toHaveURL('/trap-the-orb/leaderboards?board=score.classic&period=week')
    await expect(page.getByRole('heading', { level: 1, name: 'Leaderboards' })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'GridMaster' })).toBeVisible()
    await page.getByRole('tab', { name: 'Records' }).click()
    await expect(page).toHaveURL('/trap-the-orb/leaderboards?board=stat.tightestTrap&period=all')

    // Switching tables replaces the history entry, so one step back returns to the game — paused, not lost.
    await page.goBack()
    await expect(page).toHaveURL(GAME_URL)
    await expect(page.getByRole('dialog', { name: 'Paused' })).toBeVisible()
  })

  test('opens the rules and the privacy policy as linkable dialogs', async ({ page }) => {
    await mockApi(page)
    await page.goto(`${GAME_URL}#how-to-play`)
    await expect(page.getByRole('heading', { name: 'How to play' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('heading', { name: 'How to play' })).toBeHidden()
    // The native <dialog> fires `close` a task later; the app then clears the hash. Wait for that, or a
    // late `close` would also clear the #privacy hash navigated to next.
    await expect(page).toHaveURL(GAME_URL)

    await page.goto(`${GAME_URL}#privacy`)
    await expect(page.getByRole('heading', { name: 'Privacy policy' })).toBeVisible()
  })

  test('offers Google and email sign-in', async ({ page }) => {
    await mockApi(page)
    await page.goto(`${GAME_URL}#account`)

    const dialog = page.getByRole('dialog', { name: 'Your account' })
    await expect(dialog.getByRole('button', { name: 'Continue with Google' })).toBeVisible()
    await expect(dialog.getByLabel('Email')).toBeVisible()
  })

  test('never scrolls sideways', async ({ page }) => {
    await mockApi(page)
    for (const path of [GAME_URL, '/trap-the-orb/leaderboards']) {
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      expect(overflow).toBeLessThanOrEqual(0)
    }
  })
})
