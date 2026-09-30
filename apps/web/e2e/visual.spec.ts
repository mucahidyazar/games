import { expect, test } from '@playwright/test'
import { mockApi } from './fakeApi.ts'

/**
 * Visual regression for the page in its initial "ready" state, tagged @visual.
 * Baselines are platform-specific (recorded on macOS), so `pnpm e2e` and CI skip these tests.
 *   pnpm e2e:visual         compare against the baselines in e2e/visual.spec.ts-snapshots/
 *   pnpm e2e:update-visual  re-record the baselines after an intended UI change
 */

/** A fixed seed keeps orb positions identical between runs. */
const GAME_URL = '/trap-the-orb?seed=42'
/** The footer shows the current year; a frozen clock keeps baselines valid past New Year. */
const FROZEN_NOW = new Date('2026-06-15T12:00:00Z')
const MAX_DIFF_PIXEL_RATIO = 0.01

const VIEWPORTS = [
  { width: 320, height: 640 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
] as const

test.describe('ready screen', { tag: '@visual' }, () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Visual baselines are recorded in Chromium only')

  for (const viewport of VIEWPORTS) {
    test.describe(`${viewport.width}px wide`, () => {
      test.use({ viewport })

      test('matches the baseline', async ({ page }) => {
        await page.clock.setFixedTime(FROZEN_NOW)
        await mockApi(page)
        await page.goto(GAME_URL)
        const readyCard = page.getByRole('dialog', { name: 'The original challenge' })
        await expect(readyCard.getByRole('button', { name: 'Play Classic' })).toBeVisible()
        await expect(page.getByRole('region', { name: 'Leaderboard' }).getByText('GridMaster')).toBeVisible()
        await page.evaluate(() => document.fonts.ready)

        await expect(page).toHaveScreenshot(`ready-${viewport.width}.png`, {
          fullPage: true,
          animations: 'disabled',
          // The orbs keep moving on the canvas even before the game starts.
          mask: [page.locator('canvas')],
          maxDiffPixelRatio: MAX_DIFF_PIXEL_RATIO,
        })
        // The mask also paints over the ready card that sits on the canvas, so the card gets its own
        // screenshot. It is opaque, so no orb shows through.
        await expect(readyCard).toHaveScreenshot(`ready-card-${viewport.width}.png`, {
          animations: 'disabled',
          maxDiffPixelRatio: MAX_DIFF_PIXEL_RATIO,
        })
      })
    })
  }
})
