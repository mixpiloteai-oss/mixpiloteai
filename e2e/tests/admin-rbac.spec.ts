// RBAC enforcement at the API layer. Frontend-only RBAC is theatre;
// these specs assert that the backend rejects the operation even when
// the moderator hits the endpoint directly.
import { test, expect } from '@playwright/test'

const BACKEND = process.env.E2E_BACKEND_URL ?? 'http://127.0.0.1:3000'

async function loginAs(api: import('@playwright/test').APIRequestContext, email: string, password: string): Promise<string> {
  const res = await api.post(`${BACKEND}/api/admin/auth/login`, { data: { email, password } })
  expect(res.status(), `login for ${email}: ${await res.text()}`).toBe(200)
  const body = await res.json() as { data: { accessToken: string } }
  return body.data.accessToken
}

test.describe('@admin @rbac permission enforcement', () => {
  test('admin without role super_admin cannot delete a user', async ({ request }) => {
    const email = process.env.E2E_ADMIN_NONROOT_EMAIL
    const password = process.env.E2E_ADMIN_NONROOT_PASSWORD
    test.skip(!email || !password, 'set E2E_ADMIN_NONROOT_* for a non-super admin')

    const token = await loginAs(request, email!, password!)
    const res = await request.delete(`${BACKEND}/api/admin/users/00000000-0000-0000-0000-000000000000`, {
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.status()).toBe(403)
  })

  test('moderator cannot create or delete coupons', async ({ request }) => {
    const email = process.env.E2E_MODERATOR_EMAIL
    const password = process.env.E2E_MODERATOR_PASSWORD
    test.skip(!email || !password, 'set E2E_MODERATOR_* to run')

    const token = await loginAs(request, email!, password!)
    const create = await request.post(`${BACKEND}/api/admin/stripe/coupons`, {
      headers: { authorization: `Bearer ${token}` },
      data: { name: 'MODTEST', percentOff: 10, duration: 'once' },
    })
    expect(create.status()).toBe(403)

    const del = await request.delete(`${BACKEND}/api/admin/stripe/coupons/MODTEST`, {
      headers: { authorization: `Bearer ${token}` },
    })
    expect(del.status()).toBe(403)
  })

  test('moderator cannot refund payments (Stripe + PayPal)', async ({ request }) => {
    const email = process.env.E2E_MODERATOR_EMAIL
    const password = process.env.E2E_MODERATOR_PASSWORD
    test.skip(!email || !password, 'set E2E_MODERATOR_* to run')

    const token = await loginAs(request, email!, password!)
    const stripe = await request.post(`${BACKEND}/api/admin/stripe/refund`, {
      headers: { authorization: `Bearer ${token}` },
      data: { chargeId: 'ch_test', reason: 'requested_by_customer' },
    })
    expect(stripe.status()).toBe(403)

    const paypal = await request.post(`${BACKEND}/api/admin/paypal/refund`, {
      headers: { authorization: `Bearer ${token}` },
      data: { captureId: 'CAP_TEST' },
    })
    expect(paypal.status()).toBe(403)
  })

  test('unauthenticated requests are rejected with 401', async ({ request }) => {
    const r = await request.get(`${BACKEND}/api/admin/stripe/analytics`)
    expect(r.status()).toBe(401)
  })
})
