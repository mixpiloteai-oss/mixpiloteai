// Shared fixtures: API-based admin + user login that bypasses the UI form
// so each spec starts from a deterministic auth state. The UI login flow
// is exercised separately in admin-login.spec.ts.
import { test as base, expect, type APIRequestContext } from '@playwright/test'

const BACKEND_URL = process.env.E2E_BACKEND_URL ?? 'http://127.0.0.1:3000'

export interface AdminSession {
  accessToken: string
  refreshToken: string
  user: { id: string; email: string; role: 'super_admin' | 'admin' | 'moderator' }
}

export interface UserSession {
  accessToken: string
  refreshToken: string
  user: { id: string; email: string; name: string; plan: string }
}

export async function adminLogin(api: APIRequestContext): Promise<AdminSession> {
  const email = process.env.E2E_ADMIN_EMAIL
  const password = process.env.E2E_ADMIN_PASSWORD
  if (!email || !password) throw new Error('E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD not set')

  const res = await api.post(`${BACKEND_URL}/api/admin/auth/login`, { data: { email, password } })
  expect(res.status(), `admin login failed: ${await res.text()}`).toBe(200)
  const body = await res.json() as { success: boolean; data: AdminSession }
  expect(body.success).toBe(true)
  return body.data
}

export async function registerUser(api: APIRequestContext, overrides: Partial<{ email: string; password: string; name: string }> = {}): Promise<UserSession> {
  const email = overrides.email ?? `pw-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
  const password = overrides.password ?? 'Playwright!Test2026'
  const name = overrides.name ?? 'Playwright User'

  const res = await api.post(`${BACKEND_URL}/api/auth/register`, { data: { email, password, name } })
  if (res.status() !== 200 && res.status() !== 201) {
    // Already registered → fall back to login
    const li = await api.post(`${BACKEND_URL}/api/auth/login`, { data: { email, password } })
    expect(li.ok(), `login fallback failed: ${await li.text()}`).toBe(true)
    const body = await li.json() as { data: UserSession }
    return body.data
  }
  const body = await res.json() as { data: UserSession }
  return body.data
}

// Playwright fixture: injects admin tokens into localStorage so the
// React shell skips the AuthGate.
export const test = base.extend<{
  adminPage: import('@playwright/test').Page
  userSession: UserSession
}>({
  adminPage: async ({ page, request, baseURL }, use) => {
    const session = await adminLogin(request)
    await page.addInitScript(([s]) => {
      const data = s as AdminSession
      localStorage.setItem('admin-jwt', data.accessToken)
      localStorage.setItem('admin-refresh', data.refreshToken)
      localStorage.setItem('admin-user-email', data.user.email)
      localStorage.setItem('admin-last-activity', String(Date.now()))
    }, [session])
    await page.goto(`${baseURL ?? ''}/#/admin`)
    await use(page)
  },

  userSession: async ({ request }, use) => {
    const session = await registerUser(request)
    await use(session)
  },
})

export { expect } from '@playwright/test'
