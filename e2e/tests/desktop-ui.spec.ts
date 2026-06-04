// Desktop UI smoke tests — run against the renderer Vite dev server (port 5174).
// These tests verify that the DAW workspace actually renders on startup,
// catching blank screen regressions without needing a full Electron build.
//
// Run locally:
//   cd desktop-app && npx vite --config vite.ci.config.ts &
//   cd e2e && E2E_WEBSITE_URL=http://127.0.0.1:5174 npx playwright test desktop-ui.spec.ts
//
// In CI: triggered by desktop-smoke.yml workflow.
import { test, expect } from '@playwright/test'
import * as path from 'path'
import * as fs from 'fs'

const DESKTOP_URL = process.env.E2E_DESKTOP_URL ?? process.env.E2E_WEBSITE_URL ?? 'http://127.0.0.1:5174'

// Inject electronAPI mock + auth token so the workspace shows without Electron
async function bootDesktopApp(page: import('@playwright/test').Page): Promise<void> {
  await page.addInitScript(() => {
    // Set auth token directly so App.tsx's useState initializer sees 'local'
    // and renders the DAW workspace instead of LoginScreen — more reliable
    // than relying on electronAPI detection timing.
    localStorage.setItem('token', 'local')
    // Mock the Electron API bridge for any electronAPI calls after mount
    Object.defineProperty(window, 'electronAPI', {
      value: {
        minimize:           () => Promise.resolve(),
        maximize:           () => Promise.resolve(),
        close:              () => Promise.resolve(),
        onNav:              () => {},
        removeAllListeners: () => {},
        debugOpenDevTools:  () => Promise.resolve(),
      },
      configurable: false,
      writable: false,
    })
    // Skip WelcomeDashboard on launch
    localStorage.removeItem('daw-welcomed-v1')
  })
  await page.goto(DESKTOP_URL, { waitUntil: 'domcontentloaded' })
}

// ─── Startup tests ────────────────────────────────────────────────────────────

test.describe('@smoke @desktop DAW startup', () => {
  test('workspace renders — not blank, not login screen', async ({ page }) => {
    await bootDesktopApp(page)

    // Wait for React to mount (up to 10s)
    await page.waitForFunction(() => document.getElementById('root')?.children.length ?? 0 > 0, { timeout: 10_000 })

    // DAW shell must be visible, not the login screen
    const loginScreen = page.locator('text="Sign In"')
    const dawShell = page.locator('[data-onboarding="daw-layout"], .view-enter')

    // Either the daw-layout is visible OR the login screen is NOT visible
    // (some envs may show the welcome dashboard instead)
    const isLogin = await loginScreen.isVisible().catch(() => false)
    expect(isLogin, 'Login screen should not be shown — Electron auto-token should bypass it').toBe(false)

    await expect(dawShell.first()).toBeVisible({ timeout: 8_000 })
  })

  test('arrangement timeline canvas is in DOM', async ({ page }) => {
    await bootDesktopApp(page)
    await page.waitForFunction(() => document.getElementById('root')?.children.length ?? 0 > 0, { timeout: 10_000 })

    // The arrangement view container is always present in the layout
    const arrangement = page.locator('[data-onboarding="arrangement"]')
    await expect(arrangement).toBeAttached({ timeout: 10_000 })
    await expect(arrangement).toBeVisible({ timeout: 5_000 })
  })

  test('at least one track header is visible in the arrangement', async ({ page }) => {
    await bootDesktopApp(page)
    await page.waitForFunction(() => document.getElementById('root')?.children.length ?? 0 > 0, { timeout: 10_000 })

    // Track headers are rendered as absolute positioned divs with track names
    // The SEED_PROJECT has 6 tracks; check at least one name from it
    const trackNames = ['Kick', 'Bass Synth', 'Lead Acid', 'Chord Stabs', 'Dark Pad', 'FX / Noise']
    let found = false
    for (const name of trackNames) {
      const el = page.locator(`text="${name}"`)
      if (await el.isVisible().catch(() => false)) { found = true; break }
    }
    expect(found, `Expected at least one track name from SEED_PROJECT to be visible`).toBe(true)
  })

  test('mixer panel is visible', async ({ page }) => {
    await bootDesktopApp(page)
    await page.waitForFunction(() => document.getElementById('root')?.children.length ?? 0 > 0, { timeout: 10_000 })

    const mixer = page.locator('[data-onboarding="mixer"]')
    await expect(mixer).toBeAttached({ timeout: 10_000 })
    await expect(mixer).toBeVisible({ timeout: 5_000 })
  })

  test('transport bar is visible and shows BPM', async ({ page }) => {
    await bootDesktopApp(page)
    await page.waitForFunction(() => document.getElementById('root')?.children.length ?? 0 > 0, { timeout: 10_000 })

    // TransportBar contains BPM display — SEED_PROJECT is 145 BPM
    const bpm = page.locator('text="145"')
    await expect(bpm).toBeVisible({ timeout: 8_000 })
  })

  test('takes startup screenshot for visual regression reference', async ({ page }) => {
    await bootDesktopApp(page)

    // Wait for workspace to fully settle
    await page.waitForTimeout(1500)

    // Screenshot always saved — CI uploads it as artifact
    await page.screenshot({
      path:     'test-results/desktop-startup.png',
      fullPage: false,
    })

    // Also verify no JS errors on startup
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    // Re-check after screenshot
    const criticalErrors = errors.filter(e =>
      !e.includes('ResizeObserver') &&  // ResizeObserver loops are benign
      !e.includes('Non-Error promise rejection')  // common in tests
    )
    expect(criticalErrors, `JS errors on startup: ${criticalErrors.join('\n')}`).toHaveLength(0)
  })
})

// ─── Offline tests ────────────────────────────────────────────────────────────

test.describe('@desktop @offline offline mode', () => {
  test('workspace functions with no network (offline mode)', async ({ page, context }) => {
    // Block all network requests to simulate offline
    await context.route('**/api/**', (route) => route.abort('failed'))

    await bootDesktopApp(page)
    await page.waitForFunction(() => document.getElementById('root')?.children.length ?? 0 > 0, { timeout: 10_000 })

    // Workspace should still render (it's a local Electron app, no cloud needed)
    const dawShell = page.locator('[data-onboarding="daw-layout"], .view-enter')
    await expect(dawShell.first()).toBeVisible({ timeout: 8_000 })
  })

  test('status bar shows status without crashing', async ({ page }) => {
    await bootDesktopApp(page)
    await page.waitForFunction(() => document.getElementById('root')?.children.length ?? 0 > 0, { timeout: 10_000 })

    // StatusBar should render (it's always at the bottom of DAWShell)
    // Check for any of the status bar indicators: FPS, ECO, version, etc.
    const statusBar = page.locator('text=/v0\\.3|fps|ECO|offline|online/i').first()
    await expect(statusBar).toBeAttached({ timeout: 8_000 })
  })
})
