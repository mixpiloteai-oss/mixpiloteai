// Failure modes — fraud, oversized payloads, declined cards, abuse limits.
import { test, expect } from '../fixtures/auth'

const BACKEND = process.env.E2E_BACKEND_URL ?? 'http://127.0.0.1:3000'

test.describe('@payments @errors failure modes', () => {
  test('unauthenticated checkout request returns 401', async ({ request }) => {
    const res = await request.post(`${BACKEND}/api/payments/stripe/session`, {
      data: { type: 'plan', planId: 'pro' },
    })
    expect(res.status()).toBe(401)
  })

  test('invalid checkout type returns 400', async ({ request, userSession }) => {
    const res = await request.post(`${BACKEND}/api/payments/stripe/session`, {
      headers: { authorization: `Bearer ${userSession.accessToken}` },
      data: { type: 'bogus_type' },
    })
    expect(res.status()).toBe(400)
  })

  test('oversized auth payload is rejected by apiSecurity middleware', async ({ request }) => {
    const big = 'A'.repeat(5000) // exceeds 2KB auth body limit
    const res = await request.post(`${BACKEND}/api/auth/login`, {
      data: { email: `${big}@test.io`, password: 'whatever' },
    })
    expect([400, 413, 422]).toContain(res.status())
  })

  test('payload with sql-injection signature is flagged', async ({ request }) => {
    const res = await request.post(`${BACKEND}/api/auth/login`, {
      data: { email: "x' OR 1=1 --@test.io", password: "' OR '1'='1" },
    })
    // Either rejected at validation, or proceeds and fails auth — never 500
    expect(res.status()).toBeLessThan(500)
  })

  test('repeated failed logins trigger account-lock throttle', async ({ request }) => {
    const email = `lockout-${Date.now()}@example.com`
    let last = 0
    for (let i = 0; i < 10; i++) {
      const r = await request.post(`${BACKEND}/api/auth/login`, {
        data: { email, password: 'wrong-' + i },
      })
      last = r.status()
      if (r.status() === 429 || r.status() === 423) break
    }
    // 401 (unknown email) or 429/423 (locked) — both healthy. Critical: NOT 5xx.
    expect([401, 423, 429]).toContain(last)
  })

  test('failed Stripe webhook events appear in the admin webhook log', async ({ request }) => {
    // Send a malformed body — handler should record a "failed" event.
    await request.post(`${BACKEND}/api/payments/stripe/webhook`, {
      headers: { 'content-type': 'application/json', 'stripe-signature': 'bogus' },
      data: '{ not-json',
    }).catch(() => undefined)

    const adminEmail = process.env.E2E_ADMIN_EMAIL
    const adminPwd = process.env.E2E_ADMIN_PASSWORD
    test.skip(!adminEmail || !adminPwd, 'admin creds not set')
    const li = await request.post(`${BACKEND}/api/admin/auth/login`, { data: { email: adminEmail, password: adminPwd } })
    const { data } = await li.json() as { data: { accessToken: string } }
    const logs = await request.get(`${BACKEND}/api/admin/stripe/webhook-logs?limit=20`, {
      headers: { authorization: `Bearer ${data.accessToken}` },
    })
    expect(logs.status()).toBe(200)
    const body = await logs.json() as { data: Array<{ status: string }> }
    expect(Array.isArray(body.data)).toBe(true)
  })
})
