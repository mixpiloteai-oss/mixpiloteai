# Neurotek E2E suite

Playwright-driven validation for the public site, admin dashboard,
payments (Stripe + PayPal sandbox), subscriptions, RBAC, and auth.

## Layout

```
e2e/
├─ playwright.config.ts        retry, screenshots, video, HTML report
├─ fixtures/auth.ts            API-based admin + user session helpers
├─ tests/
│  ├─ smoke.spec.ts            public routes + /health
│  ├─ pricing.spec.ts          DB-driven plans visible on /pricing
│  ├─ admin-login.spec.ts      UI auth gate + logout
│  ├─ admin-rbac.spec.ts       RBAC denied at the API layer
│  ├─ admin-dashboard.spec.ts  MRR / churn / PayPal cards live
│  ├─ checkout-stripe.spec.ts  hosted Checkout + webhook signature
│  ├─ checkout-paypal.spec.ts  create-order + webhook envelope
│  ├─ subscriptions.spec.ts    /my, upgrade, cancel, coupons
│  ├─ refresh-token.spec.ts    rotation, theft detection, logout-all
│  └─ payment-errors.spec.ts   401/400/oversized/lockout/webhook fail
└─ .env.example                copy → .env, never commit
```

## Run locally

```bash
cd e2e
cp .env.example .env             # fill in staging URLs + creds
npm ci
npm run install:browsers
npm test                         # full suite
npm run test:smoke               # just the smoke set
npm run test:headed              # headed mode for debugging
npm run report                   # open the last HTML report
```

To boot the backend + website automatically:
```bash
E2E_WEB_SERVER=1 E2E_WEBSITE_URL=http://127.0.0.1:5173 npm test
```

## CI

`.github/workflows/playwright.yml` runs in two stages:

1. `smoke` — every push / PR. No secrets required.
2. `full-suite` — pushes to `main` / `claude/**`, nightly cron, and PRs
   labelled `run-e2e-full`. Requires the secrets listed in
   `.env.example` to be configured under the repo Settings → Secrets.

HTML reports + failure traces are uploaded as artifacts (retention:
14d for traces, 30d for reports). Optional Slack notifier hooks into
`E2E_SLACK_WEBHOOK_URL`.

## Self-hosted runner (optional)

Set the repo variable `E2E_RUNNER` to your runner label (e.g.
`self-hosted-staging`) and the `full-suite` job will target it. This
is recommended for stable IP allowlisting against Stripe webhook
endpoints and PayPal sandbox throttles.

Bootstrap on the runner:

```bash
# Ubuntu 22.04+
sudo apt-get update && sudo apt-get install -y \
  libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libgbm1 \
  libasound2 libpangocairo-1.0-0 libgtk-3-0
node --version  # >= 22
```

## Tags

Tests are tagged so CI can slice them:

- `@smoke`        — fast, public, no secrets
- `@admin`        — admin shell + sidebar + tabs
- `@rbac`         — permission denials
- `@analytics`    — dashboard live data
- `@payments`     — Stripe + PayPal + subscriptions
- `@stripe`       — Stripe-only
- `@paypal`       — PayPal-only
- `@subscriptions` — sub lifecycle
- `@errors`       — failure modes
- `@auth`         — login / refresh / logout
- `@cross-browser` — Firefox + WebKit projects
- `@mobile`       — Pixel 5 viewport project

Example:
```bash
npx playwright test --grep "@payments"
npx playwright test --grep "@admin and not @analytics"
```
