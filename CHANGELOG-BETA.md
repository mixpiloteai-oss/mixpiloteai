# Neurotek Studio — Beta Release Notes

## Scope

This branch (`claude/add-search-qa-vZqub`) brings the platform from
internal-dev state to production-ready beta. Highlights:

### Payments
- **Stripe**: real checkout sessions, customer portal, webhook signature
  verification (timing-safe, 5-min replay window), subscription upgrade /
  downgrade / cancel / reactivate, refunds with audit log, coupon CRUD,
  invoice listing, customer billing portal sessions.
- **PayPal**: real REST v2 integration — orders, captures, subscriptions,
  refunds, transaction reporting, webhook event verification, dedicated
  admin dashboard.
- **Webhook event log**: every Stripe and PayPal webhook (success,
  signature failure, parse error, processing exception) lands in an
  in-memory ring buffer surfaced through the admin UI.

### Subscriptions
- Real upgrade flow hitting Stripe's subscription update endpoint and
  syncing back to the DB.
- Period-end cancel + immediate cancel.
- Reactivation (clears `cancel_at_period_end`).
- Coupon validation and redemption.
- Per-plan limits enforced via the new `FullPlan` model.

### Admin dashboard
- Live data: MRR, ARR, churn rate, today/total revenue (Stripe + PayPal),
  active subscriptions, failed payments, refund totals, ARPU, balance.
- New pages: `StripeAdmin`, `PayPalAdmin` — analytics, invoices,
  transactions, subscriptions, coupons, webhook logs.
- Server-side events stream for activity and live metrics.

### Auth + security
- Access + refresh tokens with `iss`, `aud`, `jti` claims and rotation.
- Refresh tokens stored as SHA-256 hashes, constant-time compared.
- Per-account login throttle (8 fails in 15 min → 30 min lock).
- API security middleware: per-route body-size limits, recursive payload
  scanning for XSS / SQL injection / path traversal.
- Response sanitization strips stack traces in production.
- Admin RBAC: `super_admin` / `admin` / `moderator` roles with a fine-
  grained permission matrix (`requirePermission(perm)` factory).
- Strict baseline security headers (CSP locked to `default-src 'none'`,
  COOP, CORP, HSTS when HTTPS).

### Stability
- Audio engine: DC blocker, silence gate, fade envelopes,
  AudioProfiler, BufferManager (Rust).
- Crash recovery: marker files, exponential-backoff restart, max retry.
- Plugin host: per-plugin sandbox, health monitor (memory leaks, CPU),
  scan cache, hot reload, auto-restart with state preservation.
- MIDI: hardened scheduler using AudioContext clock, stuck-note
  watchdog, humanize, quantize with groove extraction.
- Backend: `retryWithBackoff` + `CircuitBreaker` for upstream Stripe /
  PayPal calls so an upstream outage no longer thunders the dashboard.

### CI/CD
- Unified `.github/workflows/ci.yml`: backend typecheck + tests,
  website typecheck + build (with artifact upload), desktop-app
  typecheck. Concurrency-bounded per ref.
- Native test suite (`node --test`): auth, RBAC, webhook signatures,
  webhook log persistence, subscription routes, resilience primitives,
  rate limits, CORS, security headers.

## Pre-deploy checklist

1. Set production env vars: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
   `PAYPAL_CLIENT_ID`, `PAYPAL_SECRET`, `PAYPAL_SANDBOX=false`,
   `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `JWT_SECRET`,
   `ADMIN_JWT_SECRET`, `FRONTEND_URL`, `SUPER_ADMIN_EMAILS`.
2. Provision Stripe products + prices matching `STRIPE_PRICES` constants
   in `backend/src/services/stripeService.ts`. Override via env vars if
   IDs differ.
3. Configure Stripe webhook endpoint → `/api/payments/stripe/webhook`
   (Events: `checkout.session.completed`, `payment_intent.succeeded`,
   `customer.subscription.deleted`, `invoice.payment_succeeded`,
   `invoice.payment_failed`).
4. Configure PayPal webhook → `/api/payments/paypal/webhook`
   (Events: `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.REFUNDED`,
   `BILLING.SUBSCRIPTION.ACTIVATED`, `BILLING.SUBSCRIPTION.CANCELLED`,
   `BILLING.SUBSCRIPTION.PAYMENT.FAILED`).
5. Run DB migrations (Supabase schema in `supabase/migrations/`).
6. Smoke-test `/health/detailed`.

## Deployment

```bash
# Backend (Railway / Fly / Render)
cd backend && npm ci && npm run build && npm start

# Website (Vercel)
cd website && npm ci && npm run build && vercel --prod

# Desktop app — Windows build is automated in
# .github/workflows/build-desktop-win.yml. Mac + Linux builds are run
# locally with: npm run dist:mac / npm run dist:linux (require their
# respective native toolchains and code-signing certificates).
```

## Rollback

```bash
# Backend (railway example)
railway rollback

# Website (vercel)
vercel rollback <deployment-url>

# Desktop app — Electron auto-updater respects the GitHub release
# channel. Mark the bad release as a draft to halt rollout.
```

## Known limitations carried into beta

- Multi-user concurrency tests + Playwright UI suite are scaffolded
  hooks only — real browser E2E requires a per-environment runner
  (recommend GitHub Actions matrix + Playwright service).
- Mac and Linux desktop builds run from contributor machines until a
  signed-runner CI lane is configured.
- `paypalAdminService.listPayPalSubscriptions` in live mode returns
  empty (PayPal has no list endpoint); the dashboard reads the local DB
  for the real-time view.
