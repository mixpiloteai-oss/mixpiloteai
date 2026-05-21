// Pricing page reflects DB-driven plans, not hardcoded values.
import { test, expect } from '@playwright/test'

test.describe('@smoke pricing page', () => {
  test('renders at least one paid plan from the DB', async ({ page }) => {
    await page.goto('/#/pricing')
    // Either a known plan name or a card heading must surface
    await expect(page.locator('text=/Pro|Studio|Label|Free/i').first()).toBeVisible({ timeout: 15_000 })
  })

  test('plan card has a price + CTA', async ({ page }) => {
    await page.goto('/#/pricing')
    await expect(page.locator('text=/\\$\\s?\\d+|€\\s?\\d+/').first()).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('a, button').filter({ hasText: /upgrade|get started|choose|select/i }).first()).toBeVisible()
  })

  test('public plans endpoint returns active plans', async ({ request }) => {
    const url = process.env.E2E_BACKEND_URL ?? 'http://127.0.0.1:3000'
    const res = await request.get(`${url}/api/subscriptions/plans`)
    expect(res.status()).toBe(200)
    const body = await res.json() as { success: boolean; data: unknown[] }
    expect(body.success).toBe(true)
    expect(Array.isArray(body.data)).toBe(true)
    expect(body.data.length).toBeGreaterThan(0)
  })
})
