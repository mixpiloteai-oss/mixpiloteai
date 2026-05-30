// Smoke tests — fast, parallel, exercise the public routes that must
// always return a working shell. Failure here halts the rest of CI.
import { test, expect } from '@playwright/test'

const PUBLIC_ROUTES = ['/', '/pricing', '/download', '/changelog', '/support', '/privacy', '/terms']

test.describe('@smoke public site shell', () => {
  for (const route of PUBLIC_ROUTES) {
    test(`renders ${route}`, async ({ page }) => {
      // Register before navigation so errors during initial load are captured
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(e.message))
      const res = await page.goto(`/#${route}`)
      expect(res?.status() ?? 0, `HTTP for ${route}`).toBeLessThan(400)
      await expect(page.locator('body')).toBeVisible()
      await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined)
      expect(errors, `console errors on ${route}: ${errors.join(' | ')}`).toHaveLength(0)
    })
  }

  test('@smoke backend /health responds 200', async ({ request }) => {
    const url = process.env.E2E_BACKEND_URL ?? 'http://127.0.0.1:3000'
    const res = await request.get(`${url}/health`)
    expect(res.status()).toBe(200)
  })
})
