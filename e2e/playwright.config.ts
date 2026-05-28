import { defineConfig, devices } from '@playwright/test'
import 'dotenv/config'

const isCI = !!process.env.CI
const WEBSITE_URL = process.env.E2E_WEBSITE_URL ?? 'http://127.0.0.1:5173'
const BACKEND_URL = process.env.E2E_BACKEND_URL ?? 'http://127.0.0.1:3000'

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 2 : undefined,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'playwright-report/results.json' }],
    ...(isCI ? [['github'] as const] : []),
  ],
  outputDir: 'test-results',
  use: {
    baseURL: WEBSITE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    ignoreHTTPSErrors: true,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox',  use: { ...devices['Desktop Firefox'] }, grep: /@cross-browser/ },
    { name: 'webkit',   use: { ...devices['Desktop Safari']  }, grep: /@cross-browser/ },
    { name: 'mobile',   use: { ...devices['Pixel 5'] },          grep: /@mobile/ },
  ],
  // Optional local dev: start website + backend if the URLs aren't reachable.
  // Disabled by default — pass E2E_WEB_SERVER=1 to opt in.
  ...(process.env.E2E_WEB_SERVER === '1'
    ? {
        webServer: [
          {
            command: 'npm --prefix ../backend run dev',
            url: `${BACKEND_URL}/health`,
            timeout: 60_000,
            reuseExistingServer: !isCI,
          },
          {
            command: 'npm --prefix ../website run dev',
            url: WEBSITE_URL,
            timeout: 60_000,
            reuseExistingServer: !isCI,
          },
        ],
      }
    : {}),
})
