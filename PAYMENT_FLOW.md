# PAYMENT FLOW DOCUMENTATION
## NeuroTek AI — End-to-End Payment Architecture

**Version:** 2.0 (Production-Grade)  
**Date:** 2026-05-27

---

## Overview

NeuroTek AI processes payments through two production payment processors:
- **Stripe** — Hosted Checkout Sessions for subscriptions and one-time purchases
- **PayPal** — REST API v2 Orders for alternative payment method

All transactions are persisted in PostgreSQL via the Supabase client. No mock data, no hardcoded amounts.

---

## Architecture Diagram

```
┌────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React)                        │
│  Billing.tsx ──→ billingApi ──→ axios + Idempotency-Key header │
└────────────────────────────┬───────────────────────────────────┘
                             │ HTTPS + JWT Bearer
                             ▼
┌────────────────────────────────────────────────────────────────┐
│                   BACKEND (Express / Node.js)                  │
│                                                                │
│  /api/payments/* ──→ requireAuth ──→ paymentsRateLimiter       │
│                  ──→ idempotencyMiddleware                      │
│                  ──→ route handler                             │
│                        │                                       │
│               ┌────────┴────────┐                             │
│               ▼                 ▼                             │
│         stripeService      paypalService                      │
│         (HTTPS to Stripe)  (HTTPS to PayPal)                  │
│               │                 │                             │
│               └────────┬────────┘                             │
│                        ▼                                       │
│              invoiceService ──→ PostgreSQL                    │
│              paymentLogService ──→ payment_events table        │
└────────────────────────────────────────────────────────────────┘
                             │
                             │ Stripe webhooks
                             │ PayPal webhooks
                             ▼
┌────────────────────────────────────────────────────────────────┐
│                    WEBHOOK HANDLERS                            │
│                                                                │
│  /api/payments/stripe/webhook                                  │
│    1. Verify HMAC-SHA256 signature                             │
│    2. Check webhook_events table (replay prevention)           │
│    3. Process event (update subscription, mark invoice paid)   │
│    4. Mark event processed in webhook_events table             │
│                                                                │
│  /api/payments/paypal/webhook                                  │
│    1. Call PayPal verify-webhook-signature API                 │
│    2. Check webhook_events table (replay prevention)           │
│    3. Process event                                            │
│    4. Mark event processed                                     │
└────────────────────────────────────────────────────────────────┘
```

---

## 1. Stripe Checkout Flow (Subscriptions & One-Time)

### Step-by-Step

```
User clicks "Upgrade to Pro"
        │
        ▼
frontend: newPaymentKey() → UUID idempotency key
        │
        ▼
POST /api/payments/stripe/session
  Headers: Authorization: Bearer <jwt>, Idempotency-Key: <uuid>
  Body: { type: 'plan', planId: 'pro', annual: false }
        │
        ▼
[idempotency middleware]
  Check idempotency_keys table
  If key exists + not expired → return cached response (no duplicate charge)
        │
        ▼
[requireAuth middleware]
  Validate JWT, extract userId
        │
        ▼
[paymentsRateLimiter]
  Check: < 10 requests / 60s per user
        │
        ▼
stripeService.createCheckoutSession({
  mode: 'subscription' | 'payment',
  line_items: [{ price: stripePrice, quantity: 1 }],
  customer_email: user.email,
  success_url: '...',
  cancel_url: '...',
  metadata: { userId, planId }
})
  Headers sent to Stripe: Idempotency-Key: <server-generated-uuid>
        │
        ▼
Response: { url: 'https://checkout.stripe.com/pay/cs_...' }
  → Stored in idempotency_keys table
        │
        ▼
frontend: window.location.href = url
        │
        ▼
[Stripe Hosted Checkout Page]
  User enters card details (PCI-DSS compliant, Stripe-controlled)
        │
        ▼
On success: Stripe redirects to /billing?success=1&session_id=cs_...
        │
        ▼
frontend: billingApi.getStripeSession(session_id)
  Verify payment status
        │
        ▼
[Stripe Webhook → /api/payments/stripe/webhook]
  Event: checkout.session.completed OR payment_intent.succeeded
  1. Verify signature (HMAC-SHA256, ±5 min window)
  2. Check replay: webhookEventRepository.isProcessed(event.id)
  3. Update subscription status in DB
  4. Create invoice record
  5. Log to payment_events
  6. Mark webhook processed: webhookEventRepository.markProcessed(...)
```

### Subscription States

```
none ──→ active (checkout.session.completed)
active ──→ cancelled (subscription_cancelled)
cancelled ──→ active (subscription_reactivated)
active ──→ past_due (payment_failed on renewal)
past_due ──→ active (payment_succeeded on retry)
past_due ──→ cancelled (invoice.payment_failed after retries exhausted)
```

---

## 2. PayPal Flow

### Step-by-Step

```
User clicks "Pay with PayPal"
        │
        ▼
frontend: newPaymentKey() → UUID idempotency key
        │
        ▼
POST /api/payments/paypal/create-order
  Headers: Authorization: Bearer <jwt>, Idempotency-Key: <uuid>
  Body: { amountUSD: '49.99', description: 'Pro Plan' }
        │
        ▼
paypalService.createOrder({
  intent: 'CAPTURE',
  purchase_units: [{ amount: { currency_code: 'USD', value: '49.99' } }]
})
  Auth: Bearer token from PayPal OAuth2 (/v1/oauth2/token)
        │
        ▼
Response: { orderId: '3MK84...', approvalUrl: 'https://paypal.com/checkoutnow?...' }
        │
        ▼
frontend: window.open(approvalUrl) OR PayPal JS SDK
        │
        ▼
User approves on PayPal
        │
        ▼
frontend: POST /api/payments/paypal/capture
  Body: { orderId: '3MK84...' }
  Headers: Idempotency-Key: <uuid>
        │
        ▼
paypalService.captureOrder(orderId)
        │
        ▼
Extract captured amount from response
Create invoice in DB
Log to payment_events
        │
        ▼
[PayPal Webhook → /api/payments/paypal/webhook]
  Event: PAYMENT.CAPTURE.COMPLETED
  1. Verify: POST paypal.com/v1/notifications/verify-webhook-signature
  2. Check replay: webhookEventRepository.isProcessed(transmission_id)
  3. Update subscription/credits
  4. Mark processed
```

---

## 3. Subscription Lifecycle

### Plans Available

| Plan | Monthly | Annual | Features |
|------|---------|--------|----------|
| Free | $0 | $0 | 50 AI credits/month |
| Pro | $19.99 | $199.99 | 500 credits, priority support |
| Studio | $49.99 | $499.99 | 2000 credits, team features |
| Label | $99.99 | $999.99 | Unlimited credits, white-label |

### Upgrade Flow

```
POST /api/subscriptions/upgrade { plan: 'pro', annual: false }
  │
  ├── subscriptionService.upgrade(userId, 'pro', false)
  │     Validates plan exists
  │     Creates Stripe Checkout Session (mode: 'subscription')
  │     Returns checkout URL
  │
  └── On webhook: checkout.session.completed
        subscriptionService.activateSubscription(userId, plan, stripeSubscriptionId)
        Log: subscription_created
```

### Cancel Flow

```
POST /api/subscriptions/cancel { immediate: false, reason: '...' }
  │
  ├── If immediate: stripe.subscriptions.cancel(stripeSubId)
  │   Status → 'cancelled', cancelledAt = now
  │
  └── If at period end: stripe.subscriptions.update({ cancel_at_period_end: true })
        Status → 'cancelling', remainingUntil = current period end
        Log: subscription_cancelled
```

### Reactivation Flow

```
POST /api/subscriptions/reactivate
  │
  └── stripe.subscriptions.update({ cancel_at_period_end: false })
        OR new checkout session for cancelled subscription
        Log: subscription_renewed
```

---

## 4. Invoice Lifecycle

### Invoice States

```
pending ──→ paid     (markPaid called on payment success)
paid    ──→ refunded (markRefunded called on refund)
pending ──→ void     (order cancelled before payment)
```

### Invoice Number Format

Sequential format: `INV-YYYY-#####` (e.g., `INV-2026-00001`)

Generated by `invoiceService.generateInvoiceNumber()`:
- Year prefix changes at midnight UTC on Jan 1
- Sequence number stored in `invoices` table (MAX(number) + 1)
- In-memory fallback uses an atomic counter when DB not configured

### Invoice Fields

```typescript
interface Invoice {
  id: string;              // UUID primary key
  number: string;          // INV-2026-00001
  userId: string;          // owner
  customerName: string;
  customerEmail: string;
  customerAddress: { line1, city, country, postalCode };
  lineItems: InvoiceLineItem[];
  subtotalCents: number;
  vatCents: number;        // 0 in most jurisdictions
  vatRate: number;         // 0.0 to 1.0
  totalCents: number;
  currency: 'USD';
  status: 'paid' | 'pending' | 'void' | 'refunded';
  paymentMethod: 'stripe' | 'paypal';
  paymentIntentId?: string;
  paypalOrderId?: string;
  createdAt: number;       // Unix timestamp ms
  paidAt?: number;
  periodStart?: number;    // Subscription billing period
  periodEnd?: number;
}
```

---

## 5. Refund Flow

```
User clicks "Request Refund" in Billing dashboard
        │
        ▼
POST /api/payments/refund
  Body: {
    paymentMethod: 'stripe' | 'paypal',
    paymentIntentId?: 'pi_...',    // Stripe
    captureId?: 'CAPTURE_ID',      // PayPal
    amountCents?: number,          // partial refund
    reason?: string
  }
        │
        ▼
[requireAuth]
  Verify userId owns the payment
        │
        ├── Stripe path:
        │   stripeService.createRefund(paymentIntentId, amountCents)
        │   → POST stripe.com/v1/refunds
        │   findByPaymentIntent(paymentIntentId) → invoice
        │   markRefunded(invoice.id)
        │   Log: refund_issued
        │
        └── PayPal path:
            paypalService.refundCapture(captureId, amountUSD)
            → POST paypal.com/v2/payments/captures/{id}/refund
            Log: refund_issued
```

---

## 6. Coupon / Discount Flow

```
User enters coupon code in checkout
        │
        ▼
POST /api/payments/coupon/validate
  Body: { code: 'SUMMER20', amountCents: 4999, planId: 'pro' }
        │
        ▼
couponService.validate(code, amountCents, planId)
  Checks: expiry, usage limit, plan applicability, minimum amount
        │
        ▼
Response: {
  valid: true,
  discountPercent: 20,
  discountCents: 1000,
  finalAmountCents: 3999,
  description: '20% off'
}
        │
        ▼
POST /api/payments/stripe/session
  Body: { ..., couponCode: 'SUMMER20' }
        │
        ▼
Stripe Checkout Session created with `discounts: [{ coupon: stripeCoponId }]`
Log: coupon_applied
```

---

## 7. Credit Pack Flow

```
User selects credit pack (e.g., "500 credits — $9.99")
        │
        ▼
POST /api/payments/stripe/session
  Body: { type: 'credits', pkg: '500' }
        │
        ▼
Amount validated server-side from creditPackManager
Stripe Checkout session: mode: 'payment', one-time
        │
        ▼
On checkout.session.completed webhook:
  creditService.addCredits(userId, 500)
  Create invoice
  Log: payment_succeeded
```

---

## 8. Database Schema (Billing Tables)

```sql
-- Invoice storage
CREATE TABLE invoices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number          TEXT NOT NULL UNIQUE,           -- INV-2026-00001
  user_id         UUID NOT NULL REFERENCES users(id),
  customer_name   TEXT NOT NULL,
  customer_email  TEXT NOT NULL,
  line_items      JSONB NOT NULL DEFAULT '[]',
  subtotal_cents  INTEGER NOT NULL,
  vat_cents       INTEGER NOT NULL DEFAULT 0,
  vat_rate        NUMERIC(5,4) NOT NULL DEFAULT 0,
  total_cents     INTEGER NOT NULL,
  currency        TEXT NOT NULL DEFAULT 'USD',
  status          TEXT NOT NULL DEFAULT 'pending',   -- paid|pending|void|refunded
  payment_method  TEXT NOT NULL DEFAULT 'stripe',    -- stripe|paypal
  payment_intent_id TEXT,
  paypal_order_id TEXT,
  paid_at         TIMESTAMPTZ,
  period_start    TIMESTAMPTZ,
  period_end      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Payment audit trail (append-only)
CREATE TABLE payment_events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID REFERENCES users(id),
  event_type       TEXT NOT NULL,
  amount_cents     INTEGER,
  currency         TEXT,
  payment_method   TEXT,
  plan_id          TEXT,
  product_id       TEXT,
  coupon_code      TEXT,
  stripe_intent_id TEXT,
  paypal_order_id  TEXT,
  ip_address       TEXT,
  success          BOOLEAN NOT NULL DEFAULT TRUE,
  error_message    TEXT,
  metadata         JSONB DEFAULT '{}',
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Webhook idempotency (replay protection)
CREATE TABLE webhook_events (
  id            TEXT PRIMARY KEY,                    -- Stripe evt_* | PayPal transmission_id
  provider      TEXT NOT NULL,                       -- stripe | paypal
  event_type    TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'processed',   -- processed | failed | skipped
  payload       JSONB,
  error_message TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Client-side idempotency keys (anti double-charge)
CREATE TABLE idempotency_keys (
  key             TEXT PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES users(id),
  endpoint        TEXT NOT NULL,
  response_status INTEGER NOT NULL,
  response_body   JSONB NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  expires_at      TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours')
);
```

---

## 9. Environment Variables Required

| Variable | Required | Description |
|----------|----------|-------------|
| `STRIPE_SECRET_KEY` | Yes (production) | Stripe API secret key (`sk_live_...`) |
| `STRIPE_WEBHOOK_SECRET` | Yes (production) | Stripe webhook signing secret (`whsec_...`) |
| `PAYPAL_CLIENT_ID` | Yes (PayPal) | PayPal REST API client ID |
| `PAYPAL_CLIENT_SECRET` | Yes (PayPal) | PayPal REST API client secret |
| `PAYPAL_WEBHOOK_ID` | Yes (PayPal webhooks) | PayPal webhook ID from dashboard |
| `SUPABASE_URL` | Yes (production) | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes (production) | Supabase service role key |
| `VITE_API_URL` | Frontend | Backend API base URL |

---

## 10. Testing Matrix

| Test Case | Type | Coverage |
|-----------|------|---------|
| Payment log entry creation | Unit | `paymentLogService.log()` |
| Failed payment logging | Unit | `event: 'payment_failed'` |
| History retrieval + sorting | Unit | `getUserHistory()` |
| History limit parameter | Unit | DB pagination |
| Stats calculation | Unit | `getStats()` |
| Invoice creation + retrieval | Unit | `createInvoice()` + `getInvoice()` |
| Invoice not found | Unit | returns `null` |
| User invoice listing | Unit | `listUserInvoices()` |
| `markPaid()` state transition | Unit | `status: 'paid'` + `paidAt` |
| `markRefunded()` transition | Unit | `status: 'refunded'` |
| `getInvoiceAsJSON()` format | Unit | Serialization |
| Webhook replay prevention | Unit | `webhookEventRepository` |
| Stripe sig: valid | Unit | HMAC-SHA256 accept |
| Stripe sig: tampered | Unit | HMAC-SHA256 reject |
| Stripe sig: stale (replay) | Unit | Timestamp window reject |
| Stripe sig: missing v1 | Unit | Format reject |
| Stripe sig: empty string | Unit | Edge case reject |
| Auth protection: history | HTTP | 401 without token |
| Auth protection: invoices | HTTP | 401 without token |
| Auth protection: stripe session | HTTP | 401 without token |
| Auth protection: paypal order | HTTP | 401 without token |
| History: authenticated | HTTP | 200 + array |
| History: limit param | HTTP | Respects limit |
| Invoices: authenticated | HTTP | 200 + array |
| Invoice: unknown id | HTTP | 404 |
| Coupon: missing fields | HTTP | 400 |
| Coupon: valid structure | HTTP | 200/404 |
| Stripe session: no key | HTTP | Error (not 2xx) |
| Double-click idempotency | HTTP | Same status both times |
| Refund: no auth | HTTP | 401 |
| Refund: missing fields | HTTP | 400 |
| Refund: missing intent id | HTTP | 400 |
| Webhook: bad signature | HTTP | Non-2xx |
| Webhook: stale timestamp | Unit | Rejected by verifier |
| PayPal: no credentials | HTTP | Error (not 2xx) |
