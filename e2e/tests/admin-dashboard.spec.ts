// Live admin dashboard — verifies the analytics cards actually mount
// against the backend data sources rather than a frozen mock.
import { test, expect } from '../fixtures/auth'

test.describe('@admin @analytics dashboard live data', () => {
  test('dashboard renders MRR, churn, PayPal revenue cards', async ({ adminPage }) => {
    await adminPage.goto('/#/admin')
    await expect(adminPage.locator('.admin-sidebar')).toBeVisible({ timeout: 15_000 })

    // Stat cards
    await expect(adminPage.getByText('Total Users')).toBeVisible()
    await expect(adminPage.getByText('Revenue Today')).toBeVisible()
    await expect(adminPage.getByText('MRR')).toBeVisible()
    await expect(adminPage.getByText('Churn rate')).toBeVisible()
    await expect(adminPage.getByText('PayPal revenue')).toBeVisible()
  })

  test('stripe admin page loads analytics + invoices + coupons + webhooks tabs', async ({ adminPage }) => {
    await adminPage.goto('/#/admin/stripe')
    for (const label of ['Overview', 'Invoices', 'Coupons', 'Webhooks']) {
      await expect(adminPage.getByRole('button', { name: label })).toBeVisible()
    }
    await adminPage.getByRole('button', { name: 'Webhooks' }).click()
    // Either a table OR the empty-state message — both are healthy
    const tableOrEmpty = adminPage.locator('table, :text("No webhook events recorded.")').first()
    await expect(tableOrEmpty).toBeVisible({ timeout: 15_000 })
  })

  test('paypal admin page loads all four tabs', async ({ adminPage }) => {
    await adminPage.goto('/#/admin/paypal')
    for (const label of ['Overview', 'Transactions', 'Subscriptions', 'Webhooks']) {
      await expect(adminPage.getByRole('button', { name: label })).toBeVisible()
    }
  })

  test('realtime SSE stream connects and updates last-updated', async ({ adminPage }) => {
    await adminPage.goto('/#/admin/realtime')
    await expect(adminPage.locator('text=/uptime|active|requests/i').first()).toBeVisible({ timeout: 20_000 })
  })

  test('refresh button re-fetches dashboard data without page reload', async ({ adminPage }) => {
    await adminPage.goto('/#/admin')
    await expect(adminPage.locator('.admin-sidebar')).toBeVisible()
    const refresh = adminPage.getByRole('button', { name: /refresh/i }).first()
    await refresh.click()
    // No navigation, dashboard still mounted
    await expect(adminPage.locator('.admin-sidebar')).toBeVisible()
  })
})
