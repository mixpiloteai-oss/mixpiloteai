# Neurotek AI Backend — Test Suite

## How to run

```bash
# All API tests
TS_NODE_PROJECT=tsconfig.test.json TS_NODE_TRANSPILE_ONLY=true \
  node --require ts-node/register --test tests/api/*.test.ts

# All security tests
TS_NODE_PROJECT=tsconfig.test.json TS_NODE_TRANSPILE_ONLY=true \
  node --require ts-node/register --test tests/security/*.test.ts

# All tests together
TS_NODE_PROJECT=tsconfig.test.json TS_NODE_TRANSPILE_ONLY=true \
  node --require ts-node/register --test tests/api/*.test.ts tests/security/*.test.ts

# Single file
TS_NODE_PROJECT=tsconfig.test.json TS_NODE_TRANSPILE_ONLY=true \
  node --require ts-node/register --test tests/api/health.test.ts
```

## What is covered

### `tests/api/`
| File | Coverage |
|------|----------|
| `health.test.ts` | GET /health — 200, JSON shape, content-type, repeated probes |
| `auth.test.ts` | Register, login, logout, /me, refresh tokens — all success + failure paths |
| `permissions.test.ts` | Public GET vs. protected POST/PATCH/DELETE on /api/projects |
| `marketplace.test.ts` | Public listing, search, featured, trending; auth-gated like/comment/download |
| `admin.test.ts` | Admin login (env creds), stats, users, monitoring, marketplace, settings |
| `plugins.test.ts` | crash-report (auth, validation, happy-path); blacklist (auth + array shape) |
| `uploads.test.ts` | Creator upload/start — auth guard, bad MIME, oversized, valid payload |
| `collaboration.test.ts` | Teams CRUD, collab ops, SSE stream, history, invite flow |

### `tests/security/`
See [security/README.md](security/README.md).

## Notes on the test runtime

- **In-memory fallback**: Supabase is not configured in CI. All services fall back to in-memory maps/arrays seeded with sample data.
- **Real JWTs**: The auth flow mints and verifies real JWT tokens using `JWT_SECRET` set in `tests/setup/env.ts`.
- **Ephemeral ports**: Each test suite boots a fresh Express server on `127.0.0.1:0` and tears it down in `after()`.
- **Rate limiters**: `generalRateLimiter` (300 req/15 min) and `authRateLimiter` (20/15 min) are active. Rate-limit tests deliberately exhaust windows and assert on 429 responses.
- **Suspicious-activity tracker**: In-memory state persists across requests within the same process. The suspicious.test.ts suite sends 25 failed logins from the same IP and expects at least one 429.

## Out of scope

- **E2E / browser**: No Playwright/Puppeteer tests. End-to-end flows belong in a separate e2e suite.
- **Stripe live calls**: Stripe endpoints use mock data in the absence of `STRIPE_SECRET_KEY`. No live Stripe calls are made.
- **Claude API**: AI endpoints are not exercised — they require a live `CLAUDE_API_KEY`.
- **Database migrations**: Supabase schema changes are not tested here.
