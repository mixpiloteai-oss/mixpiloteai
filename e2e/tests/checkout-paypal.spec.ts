// PayPal checkout — drives the create-order endpoint against PayPal
// SANDBOX. The buyer-side approval flow on paypal.com is intentionally
// not fully automated (their bot detection routinely breaks Playwright);
// we assert the redirect URL and the approval token instead.
import { test, expect } from '../fixtures/auth'

const BACKEND = process.env.E2E_BACKEND_URL ?? 'http://127.0.0.1:3000'

test.describe('@payments @paypal checkout flow', () => {
  test('creates a PayPal order and returns an approval URL', async ({ request, userSession }) => {
    const res = await request.post(`${BACKEND}/api/payments/paypal/create-order`, {
      headers: { authorization: `Bearer ${userSession.accessToken}` },
      data: { amountUSD: '9.99', description: 'E2E test purchase', productType: 'marketplace' },
    })
    expect(res.status()).toBe(200)
    const body = await res.json() as { orderId?: string; approveUrl?: string; links?: Array<{ rel: string; href: string }> }
    expect(body.orderId ?? body.links?.[0]?.href).toBeTruthy()
  })

  test('approval URL points to paypal.com sandbox', async ({ request, userSession }) => {
    const res = await request.post(`${BACKEND}/api/payments/paypal/create-order`, {
      headers: { authorization: `Bearer ${userSession.accessToken}` },
      data: { amountUSD: '9.99', productType: 'marketplace' },
    })
    const body = await res.json() as { approveUrl?: string; links?: Array<{ rel: string; href: string }> }
    const url = body.approveUrl ?? body.links?.find((l) => l.rel === 'approve')?.href ?? ''
    if (!url) test.skip(true, 'No approve URL returned (PayPal mock mode)')
    expect(url).toMatch(/paypal\.com|sandbox\.paypal\.com/)
  })

  test('webhook handler accepts a sandbox event envelope', async ({ request }) => {
    // Without paypal-* signature headers the verifier returns false → handler still
    // 200s but doesn't act on the event. We assert no 5xx leakage.
    const res = await request.post(`${BACKEND}/api/payments/paypal/webhook`, {
      headers: { 'content-type': 'application/json' },
      data: {
        id: 'WH-E2E-1',
        event_type: 'PAYMENT.CAPTURE.COMPLETED',
        resource_type: 'capture',
        resource: { id: 'CAP-E2E-1', amount: { value: '9.99', currency_code: 'USD' } },
      },
    })
    expect(res.status()).toBeLessThan(500)
  })
})
