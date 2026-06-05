import { defineConfig, devices } from '@playwright/test'
import 'dotenv/config'

const isCI = !!process.env.CI
const DESKTOP_URL = process.env.E2E_DESKTOP_URL ?? process.env.E2E_WEBSITE_URL ?? 'http://127.0.0.1:5174'

export default defineConfig({
  testDir: './tests',
  testMatch: ['**/desktop-ui.spec.ts'],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ...(isCI ? [['github'] as const] : []),
  ],
  outputDir: 'test-results',
  use: {
    baseURL: DESKTOP_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 20_000,
    navigationTimeout: 30_000,
    ignoreHTTPSErrors: true,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
})
