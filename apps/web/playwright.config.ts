import { defineConfig, devices } from '@playwright/test'

const PORT = 4173
const isCI = Boolean(process.env.CI)

/**
 * Visual regression tests are tagged `@visual`. Their baselines are platform-specific
 * (rendered on macOS), so a plain `playwright test` — and CI on Linux — skips them.
 * Playwright applies `grepInvert` on top of the CLI `--grep`, so it is lifted when
 * the command line asks for the tag: `pnpm e2e:visual` / `pnpm e2e:update-visual`.
 */
const VISUAL_TAG = '@visual'
const isVisualRun = process.argv.some((arg) => arg.includes(VISUAL_TAG))

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  // CI also writes the HTML report, which the workflow uploads when a run fails.
  reporter: isCI ? [['github'], ['html', { open: 'never' }]] : 'list',
  grepInvert: isVisualRun ? undefined : new RegExp(VISUAL_TAG),
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop-chrome', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'desktop-firefox', use: { ...devices['Desktop Firefox'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile-safari', use: { ...devices['iPhone 13'] } },
  ],
  webServer: {
    command: `pnpm build && pnpm preview --host 127.0.0.1 --strictPort`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
})
