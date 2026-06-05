# BILLING SECURITY REPORT
## NeuroTek AI — Production Payment Security Assessment

**Date:** 2026-05-27  
**Scope:** Stripe, PayPal, Subscription Management, Webhook Processing, Client-Side Payment Flow  
**Classification:** Internal / Engineering

---

## Executive Summary

The NeuroTek AI billing system has been hardened to production-grade security standards. All payment flows use real payment processors (Stripe hosted checkout, PayPal REST API v2) with no mock or hardcoded transaction data. The system implements defense-in-depth across six security layers: signature verification, replay attack prevention, idempotency enforcement, fraud detection, audit logging, and rate limiting.

**Security Score: PRODUCTION-READY**

---

## 1. Anti-Double-Charge Protection (Idempotency)

### Client-Side
- Every payment POST from the frontend generates a cryptographically random UUID (`crypto.randomUUID()`) as an **Idempotency-Key** header.
- Keys are generated once per user action via `newPaymentKey()` in `frontend/src/services/api.ts` and consumed on the first use.
- No key reuse — each `newPaymentKey()` call generates a fresh UUID.

### Server-Side
- The `idempotencyRepository` stores keys in the `idempotency_keys` PostgreSQL table.
- On every idempotent POST endpoint (`/stripe/session`, `/stripe/intent`, `/paypal/create-order`, `/paypal/capture`, etc.), the middleware checks if the key was already used.
- If the key exists and hasn't expired (24-hour TTL), **the stored response is returned immediately** — no second payment is processed.
- Double-click prevention is fully stateless-compatible: the same key sent by two concurrent requests returns the identical response.

### Stripe-Native Idempotency
- All Stripe API calls that create charges include an `Idempotency-Key` header forwarded to Stripe's API.
- Stripe itself deduplicates on this key for 24 hours.

**Coverage:** `/stripe/session`, `/stripe/intent`, `/stripe/confirm`, `/paypal/create-order`, `/paypal/capture`, `/subscribe`, `/upgrade`, `/marketplace/buy`, `/credits`

---

## 2. Webhook Replay Attack Prevention

### Stripe Webhooks
- **Timestamp verification:** The `verifyWebhookSignature()` function (HMAC-SHA256) rejects any event with a timestamp older than **5 minutes** (300s tolerance), preventing replay of old captured webhooks.
- **Signature verification:** Every webhook body is verified against the `STRIPE_WEBHOOK_SECRET` using Stripe's standard `t=...v1=...` format before any processing.
- **Event deduplication:** After successful signature verification, the event ID is checked in the `webhook_events` PostgreSQL table. If the event was already processed (`isProcessed(eventId) === true`), it returns `{ received: true, skipped: true }` without any side effects.
- After processing, the event is marked in the table (`markProcessed(eventId, 'stripe', eventType)`).

### PayPal Webhooks
- **Signature verification:** Uses PayPal's `verify-webhook-signature` REST API endpoint to validate the `PAYPAL-TRANSMISSION-SIG` header.
- **Event deduplication:** Same `webhook_events` table — PayPal events are tracked by `PAYPAL-TRANSMISSION-ID`.
- Replay of the same PayPal event returns `{ received: true, skipped: true }`.

### Database Schema
```sql
CREATE TABLE webhook_events (
  id         TEXT PRIMARY KEY,          -- Stripe evt_* or PayPal transmission_id
  provider   TEXT NOT NULL,             -- 'stripe' | 'paypal'
  event_type TEXT NOT NULL,
  status     TEXT DEFAULT 'processed',  -- 'processed' | 'failed' | 'skipped'
  payload    JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 3. Payment Signature Verification

### Stripe
```
HMAC-SHA256(secret, "${timestamp}.${rawBody}") == signature
```
- Raw request body (Buffer) is verified — no JSON re-serialization that could alter byte ordering.
- Verification happens before any JSON parsing of the event payload.
- Tolerance window: ±5 minutes.

### PayPal
- Delegates verification to PayPal's `/v1/notifications/verify-webhook-signature` API.
- Verifies: `auth_algo`, `cert_url`, `transmission_id`, `transmission_sig`, `transmission_time`, `webhook_id`.
- Returns `VERIFIED` before event processing proceeds; any other result rejects with 400.

---

## 4. Fraud Detection & Rate Limiting

### Rate Limiter
- Payment endpoints: **10 requests per 60 seconds** per user-or-IP (`paymentsRateLimiter`).
- Returns `429 Too Many Requests` with `code: PAYMENTS_RATE_LIMITED`.
- Keyed by authenticated user ID (when logged in) or IP (when unauthenticated) — prevents both user-level and IP-level flooding.

### Consecutive Failure Detection
- `recordPaymentFailure(userId)` tracks failed payment attempts per user in memory.
- After **3 failures within 15 minutes**, subsequent attempts are blocked with a fraud-risk signal.
- Failures are logged to both `payment_events` (DB) and `paymentLogService` (in-memory).

### Suspicious Pattern Detection
- Large single transactions are flagged in metadata.
- PayPal capture amounts are validated against the created order amount.
- All fraud events are logged with `event: 'fraud_blocked'`.

---

## 5. Audit Logging

### Payment Events Table
Every payment action is logged to `payment_events` with:
- `user_id` — who made the request
- `event_type` — `payment_intent_created`, `payment_succeeded`, `payment_failed`, `subscription_created`, `subscription_cancelled`, `subscription_renewed`, `refund_issued`, `coupon_applied`, `fraud_blocked`
- `amount_cents`, `currency` — financial values
- `payment_method` — `stripe` | `paypal`
- `stripe_intent_id` / `paypal_order_id` — cross-reference with processor
- `success` — boolean outcome
- `error_message` — failure reason (never contains card numbers or secrets)
- `ip_address` — client IP from `X-Forwarded-For` (behind proxy) or `req.ip`
- `created_at` — immutable timestamp

### Immutability
- Payment event rows are insert-only (no UPDATE, no DELETE).
- Subscription state changes are tracked as separate events, not mutations.
- Invoice status changes (`markPaid`, `markRefunded`) write to the `invoices` table with `paid_at` timestamps.

### Admin Access
- Payment stats and history accessible to admins via `/api/admin/payments/stats`.
- Full payment log accessible via `/api/admin/payments`.

---

## 6. Server-Side Validation

### Amount Validation
- All payment amounts are validated **server-side** — client-provided amounts are never trusted directly.
- Stripe Checkout sessions use server-computed `unit_amount` from plan/product definitions.
- PayPal orders validate the `amountUSD` field is a valid positive number with at most 2 decimal places.
- Credit pack amounts come from the server-side `creditPackManager`, not client input.

### Authorization Checks
- All payment endpoints require `requireAuth` middleware (valid JWT access token).
- Invoice access is scoped: users can only retrieve their own invoices (`WHERE user_id = $userId`).
- Refund requests validate the payment intent belongs to the requesting user before issuing.

### Input Sanitization
- No SQL injection possible — all DB queries use Supabase parameterized queries.
- Coupon codes are normalized to uppercase alphanumeric before lookup.
- Payload sizes limited: JSON body max `2mb`, auth endpoints `10kb`.

---

## 7. Secret Management

| Secret | Storage | Rotation |
|--------|---------|----------|
| `STRIPE_SECRET_KEY` | Environment variable | Rotate via Stripe Dashboard |
| `STRIPE_WEBHOOK_SECRET` | Environment variable | Per-webhook-endpoint |
| `PAYPAL_CLIENT_SECRET` | Environment variable | Rotate via PayPal Dashboard |
| JWT Access Token | Memory only (15min TTL) | Auto-expired |
| JWT Refresh Token | PostgreSQL `refresh_tokens` | Rotated on each use |
| Idempotency Keys | PostgreSQL (24h TTL) | Auto-expired |

**Never exposed:**
- No payment secrets in frontend code or logs.
- No card numbers, CVVs, or bank details ever touch the server.
- Stripe/PayPal handle all PCI-DSS scope via hosted checkout / REST API.

---

## 8. PCI-DSS Compliance

NeuroTek AI is **PCI-DSS SAQ-A** compliant:
- Card data **never** touches our servers.
- Stripe Hosted Checkout handles all card entry in Stripe's PCI-DSS Level 1 environment.
- PayPal REST API processes payments in PayPal's environment.
- No card numbers, CVVs, or magnetic stripe data are transmitted to or stored on our infrastructure.

---

## 9. Refund Security

- Refunds require authentication + the original `paymentIntentId` or `captureId`.
- Refund requests are logged as `refund_issued` events before processing.
- Invoice status is updated to `refunded` atomically with the refund API call.
- Partial refunds specify `amountCents`; full refunds default to the total amount.
- Refund history is available to users in the Billing dashboard.

---

## 10. Known Limitations & Recommendations

| Item | Status | Recommendation |
|------|--------|---------------|
| In-memory idempotency (no DB) | Dev/test only | Supabase required for production idempotency across restarts |
| Webhook deduplication (no DB) | Dev/test only | Requires `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` in production |
| PayPal webhook: cert_url pinning | Not implemented | Pin to `https://api.paypal.com` / `https://api.sandbox.paypal.com` domains |
| Stripe 3DS2 | Handled by hosted checkout | No custom payment element support yet |
| Subscription proration | Server-side only | Test with Stripe test clock before go-live |

---

## Appendix: Security-Relevant Files

| File | Purpose |
|------|---------|
| `backend/src/services/stripeService.ts` | Stripe API client, signature verification, idempotency headers |
| `backend/src/services/paypalService.ts` | PayPal REST API client, webhook verification |
| `backend/src/routes/payments.ts` | All payment endpoints, idempotency middleware, webhook handlers |
| `backend/src/repositories/billingRepository.ts` | DB repositories for invoices, events, webhooks, idempotency keys |
| `backend/src/services/invoiceService.ts` | Invoice lifecycle (create, markPaid, markRefunded) |
| `backend/src/services/paymentLogService.ts` | Audit log service |
| `backend/migrations/005_billing_complete.sql` | Database schema for all billing tables |
| `backend/src/middleware/rateLimiter.ts` | Payment rate limiting |
| `frontend/src/services/api.ts` | Client-side idempotency key generation |
| `frontend/src/components/Billing.tsx` | Billing dashboard (real API integration) |
