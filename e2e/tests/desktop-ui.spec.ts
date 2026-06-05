// Desktop UI smoke tests — run against the renderer Vite dev server (port 5174).
// Goal: verify the app boots without crashing, auth bypass works, React mounts.
//
// These tests intentionally avoid asserting on complex Electron-only UI elements
// (mixer panels, arrangement canvas, etc.) that require the full Electron IPC
// bridge to render correctly. The startup screenshot is the artifact for visual
// regression review.
//
// Run locally:
//   cd desktop-app && npx vite --config vite.ci.config.ts &
//   cd e2e && E2E_DESKTOP_URL=http://127.0.0.1:5174 npx playwright test --config playwright.desktop.config.ts
//
// In CI: triggered by desktop-smoke.yml workflow.
import { test, expect } from '@playwright/test'

const DESKTOP_URL = process.env.E2E_DESKTOP_URL ?? process.env.E2E_WEBSITE_URL ?? 'http://127.0.0.1:5174'

// Inject auth token + Electron API mock so the app skips LoginScreen
async function bootDesktopApp(page: import('@playwright/test').Page): Promise<void> {
  await page.addInitScript(() => {
    // Set auth token directly — App.tsx useState lazy initializer reads this
    // and returns 'local', bypassing the LoginScreen without needing Electron.
    localStorage.setItem('token', 'local')

    // Build a comprehensive electronAPI mock.
    // Known methods with meaningful return values are listed explicitly; every
    // other property access returns a no-op via Proxy so new IPC calls added to
    // the renderer don't break this test.
    const base: Record<string, (...args: unknown[]) => unknown> = {
      minimize:           () => Promise.resolve(),
      maximize:           () => Promise.resolve(),
      close:              () => Promise.resolve(),
      isMaximized:        () => Promise.resolve(false),
      onNav:              () => {},
      removeAllListeners: () => {},
      debugOpenDevTools:  () => Promise.resolve(),
      // crash / recovery
      crashCheck:              () => Promise.resolve({ hadCrash: false, checkpoint: null }),
      crashClearCheckpoint:    () => Promise.resolve(),
      crashSaveCheckpoint:     () => Promise.resolve(),
      onCrashRecoveryAvailable:() => {},
      // save triggers
      onTriggerSave:  () => {},
      onTriggerLoad:  () => {},
      onMenuAction:   () => {},
      onPowerEvent:   () => {},
      // update events
      onUpdateChecking:        () => {},
      onUpdateAvailable:       () => {},
      onUpdateNotAvailable:    () => {},
      onUpdateProgress:        () => {},
      onUpdateDownloaded:      () => {},
      onUpdateError:           () => {},
      onUpdateIntegrityReady:  () => {},
      // plugin events
      onPluginCrashed:          () => {},
      onPluginRecovered:        () => {},
      onPluginRecoveryFailed:   () => {},
      onPluginRecoveryAbandoned:() => {},
      onPluginResourceWarning:  () => {},
    }
    // Proxy: any property not in base returns a no-op that resolves to undefined
    const mock = new Proxy(base, {
      get(target, prop: string) {
        return prop in target ? target[prop] : () => Promise.resolve()
      },
    })
    Object.defineProperty(window, 'electronAPI', {
      value: mock,
      configurable: false,
      writable: false,
    })

    // Remove any persisted welcome state that might block the UI
    localStorage.removeItem('daw-welcomed-v1')
  })
  await page.goto(DESKTOP_URL, { waitUntil: 'domcontentloaded' })
}

// ─── Infrastructure tests ─────────────────────────────────────────────────────

test.describe('@smoke @desktop DAW startup', () => {
  test('Vite renderer serves HTML with #root element', async ({ page }) => {
    await bootDesktopApp(page)

    // Basic page structure must exist
    const title = await page.title()
    expect(title, 'Page title should indicate the DAW app').toContain('Neurotek')

    const root = page.locator('#root')
    await expect(root).toBeAttached({ timeout: 5_000 })
  })

  test('React mounts successfully — #root has children', async ({ page }) => {
    await bootDesktopApp(page)

    // Wait for React to mount (children appear inside #root)
    await page.waitForFunction(
      () => (document.getElementById('root')?.childElementCount ?? 0) > 0,
      { timeout: 15_000 }
    )

    const root = page.locator('#root')
    const childCount = await root.evaluate((el) => el.childElementCount)
    expect(childCount, '#root must have at least one React-rendered child').toBeGreaterThan(0)
  })

  test('auth bypass works — token is set before React renders', async ({ page }) => {
    await bootDesktopApp(page)

    // Verify the init script ran and token is in localStorage
    const token = await page.evaluate(() => localStorage.getItem('token'))
    expect(token, 'Auth token must be set by addInitScript before React mounts').toBe('local')
  })

  test('login screen is NOT shown after auth bypass', async ({ page }) => {
    await bootDesktopApp(page)

    // Wait for React to mount
    await page.waitForFunction(
      () => (document.getElementById('root')?.childElementCount ?? 0) > 0,
      { timeout: 15_000 }
    )

    // LoginScreen contains email/password inputs — these must NOT be present
    const emailInput = page.locator('input[type="email"], input[placeholder*="email" i], input[placeholder*="Email" i]')
    const passwordInput = page.locator('input[type="password"]')

    const hasEmail    = await emailInput.count() > 0
    const hasPassword = await passwordInput.count() > 0

    expect(
      hasEmail && hasPassword,
      'Login screen (email+password inputs) must not be shown — token bypass should work'
    ).toBe(false)
  })

  test('takes startup screenshot for visual regression reference', async ({ page }) => {
    await bootDesktopApp(page)

    // Collect page errors for analysis
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))

    // Wait for React to mount, then let animations settle
    await page.waitForFunction(
      () => (document.getElementById('root')?.childElementCount ?? 0) > 0,
      { timeout: 15_000 }
    )
    await page.waitForTimeout(1500)

    // Screenshot always saved — CI uploads it as artifact for visual review
    await page.screenshot({
      path:     'test-results/desktop-startup.png',
      fullPage: false,
    })

    // Filter out benign browser warnings
    const criticalErrors = errors.filter((e) =>
      !e.includes('ResizeObserver') &&
      !e.includes('Non-Error promise rejection') &&
      !e.includes('AudioContext') &&  // Web Audio not available headless
      !e.includes('getUserMedia')     // Media API not available headless
    )
    expect(
      criticalErrors,
      `Critical JS errors on startup:\n${criticalErrors.join('\n')}`
    ).toHaveLength(0)
  })
})

// ─── Offline mode ─────────────────────────────────────────────────────────────

test.describe('@desktop @offline offline mode', () => {
  test('app loads with all API calls blocked (offline simulation)', async ({ page, context }) => {
    // Block all backend/cloud requests to simulate offline
    await context.route('**/api/**', (route) => route.abort('failed'))

    await bootDesktopApp(page)

    // React must still mount — the DAW is a local app
    await page.waitForFunction(
      () => (document.getElementById('root')?.childElementCount ?? 0) > 0,
      { timeout: 15_000 }
    )

    const root = page.locator('#root')
    const childCount = await root.evaluate((el) => el.childElementCount)
    expect(childCount, 'App must render even with no network access').toBeGreaterThan(0)
  })

  test('auth token persists in offline mode', async ({ page, context }) => {
    await context.route('**/api/**', (route) => route.abort('failed'))
    await bootDesktopApp(page)

    const token = await page.evaluate(() => localStorage.getItem('token'))
    expect(token).toBe('local')
  })
})
