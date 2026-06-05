// Subscription lifecycle — upgrade, cancel-at-period-end, reactivate,
// coupon validation. Run against the real Stripe test mode subscription
// returned by the checkout flow above.
import { test, expect } from '../fixtures/auth'

const BACKEND = process.env.E2E_BACKEND_URL ?? 'http://127.0.0.1:3000'

test.describe('@payments @subscriptions lifecycle', () => {
  test('GET /my returns the current plan + quota', async ({ request, userSession }) => {
    const res = await request.get(`${BACKEND}/api/subscriptions/my`, {
      headers: { authorization: `Bearer ${userSession.accessToken}` },
    })
    expect(res.status()).toBe(200)
    const body = await res.json() as { success: boolean; data: { plan?: { id?: string; slug?: string } } }
    expect(body.success).toBe(true)
    expect(body.data).toBeTruthy()
  })

  test('upgrade rejects an unknown plan', async ({ request, userSession }) => {
    const res = await request.post(`${BACKEND}/api/subscriptions/upgrade`, {
      headers: { authorization: `Bearer ${userSession.accessToken}` },
      data: { plan: 'enterprise-xyz' },
    })
    expect(res.status()).toBe(400)
  })

  test('cancel without an active subscription returns 404 or graceful no-op', async ({ request, userSession }) => {
    const res = await request.post(`${BACKEND}/api/subscriptions/cancel`, {
      headers: { authorization: `Bearer ${userSession.accessToken}` },
      data: { immediate: false },
    })
    expect([200, 404]).toContain(res.status())
  })

  test('validate-coupon requires code + amountCents', async ({ request, userSession }) => {
    const res = await request.post(`${BACKEND}/api/subscriptions/validate-coupon`, {
      headers: { authorization: `Bearer ${userSession.accessToken}` },
      data: {},
    })
    expect(res.status()).toBe(400)
  })

  test('validate-coupon with bogus code returns 400 with reason', async ({ request, userSession }) => {
    const res = await request.post(`${BACKEND}/api/subscriptions/validate-coupon`, {
      headers: { authorization: `Bearer ${userSession.accessToken}` },
      data: { code: 'BOGUS_____', amountCents: 999, planId: 'pro' },
    })
    expect(res.status()).toBe(400)
    const body = await res.json() as { error?: string }
    expect(body.error).toBeTruthy()
  })
})
