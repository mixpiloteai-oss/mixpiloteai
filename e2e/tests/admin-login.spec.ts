// UI-driven admin login + logout. The other admin specs use a fixture
// that bypasses this form, so this is the only place it gets exercised.
import { test, expect } from '@playwright/test'

test.describe('@admin login flow', () => {
  test('shows the auth gate when not logged in', async ({ page }) => {
    await page.goto('/#/admin')
    await expect(page.getByText('Admin Access')).toBeVisible()
    await expect(page.getByPlaceholder(/admin@/i)).toBeVisible()
    await expect(page.getByPlaceholder(/password/i)).toBeVisible()
  })

  test('rejects invalid credentials with a visible error', async ({ page }) => {
    await page.goto('/#/admin')
    await page.getByPlaceholder(/admin@/i).fill('wrong@example.com')
    await page.getByPlaceholder(/password/i).fill('definitely-wrong')
    await page.getByRole('button', { name: /access admin panel/i }).click()
    await expect(page.locator('.admin-auth-error')).toBeVisible({ timeout: 10_000 })
    // Stay on /admin — must NOT redirect to /login
    expect(page.url()).toContain('/admin')
    expect(page.url()).not.toContain('/login')
  })

  test('accepts valid credentials and lands on the dashboard', async ({ page }) => {
    const email = process.env.E2E_ADMIN_EMAIL ?? ''
    const password = process.env.E2E_ADMIN_PASSWORD ?? ''
    test.skip(!email || !password, 'E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD not set')

    await page.goto('/#/admin')
    await page.getByPlaceholder(/admin@/i).fill(email)
    await page.getByPlaceholder(/password/i).fill(password)
    await page.getByRole('button', { name: /access admin panel/i }).click()

    await expect(page.locator('.admin-sidebar')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/dashboard/i).first()).toBeVisible()
  })

  test('logout clears the session and returns to the auth gate', async ({ page, request }) => {
    const email = process.env.E2E_ADMIN_EMAIL ?? ''
    const password = process.env.E2E_ADMIN_PASSWORD ?? ''
    test.skip(!email || !password, 'admin creds not set')

    // Seed via API
    const backend = process.env.E2E_BACKEND_URL ?? 'http://127.0.0.1:3000'
    const login = await request.post(`${backend}/api/admin/auth/login`, { data: { email, password } })
    const body = await login.json() as { data: { accessToken: string; refreshToken: string; user: { email: string } } }
    await page.addInitScript((s) => {
      localStorage.setItem('admin-jwt', s.accessToken)
      localStorage.setItem('admin-refresh', s.refreshToken)
      localStorage.setItem('admin-user-email', s.user.email)
    }, body.data)

    await page.goto('/#/admin')
    await expect(page.locator('.admin-sidebar')).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: /logout/i }).click()
    await expect(page.getByText('Admin Access')).toBeVisible({ timeout: 10_000 })
  })
})
