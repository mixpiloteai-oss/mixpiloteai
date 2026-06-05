# Security Tests

Each file validates a distinct security layer of the API server.

## `headers.test.ts` — HTTP security headers
Verifies that every response from `GET /health` includes the expected hardened headers:
- `X-Content-Type-Options: nosniff` — prevents MIME-type sniffing
- `X-Frame-Options: DENY` — prevents clickjacking via iframe embedding
- `Referrer-Policy` present — controls information leakage via the Referer header
- `Permissions-Policy` present — restricts browser feature access
- No `X-Powered-By` — suppresses Express version disclosure

## `cors.test.ts` — Cross-Origin Resource Sharing policy
- Requests from untrusted origins (e.g. `https://evil.attacker.com`) must NOT receive `Access-Control-Allow-Origin` echoing that origin
- Trusted origins (`https://mixpiloteai.vercel.app`, `http://localhost:5173`) receive the correct ACAO header
- Server-to-server requests (no `Origin` header) return 200 OK

## `validate.test.ts` — Input validation helper
Unit tests for `src/utils/validate.ts` using mock Express req/res objects (no server required):
- Required fields, type checking (string/number/email), min/max string length
- Returns `false` + `res.status(400).json(...)` on failure
- Returns `true` with no side effects on valid input

## `validateEnv.test.ts` — Environment variable validation
Uses `child_process.spawnSync` to test `validateEnv()` in isolation:
- In `NODE_ENV=production` with an insecure `JWT_SECRET`, the process must exit with code ≠ 0
- In `NODE_ENV=production` with a strong `JWT_SECRET`, the process exits 0 and prints `VALIDATE_ENV_OK`

## `rate-limits.test.ts` — General rate limiter
Sends 320 sequential requests to `GET /health` from the same IP. Because `generalRateLimiter` allows 300 requests per 15 minutes, at least one must return 429. This validates that the limiter is wired globally in `app.ts`.

## `suspicious.test.ts` — Suspicious-activity detector
Sends 25 consecutive failed login attempts (`POST /api/auth/login` with wrong passwords) from the same loopback IP. Asserts that at least one returns 429 — either from `authRateLimiter` (20/15 min) or from `blockSuspicious` quarantine (triggered at 20 auth failures in 10 min).

## `auth-protection.test.ts` — Auth middleware behaviour
- Protected routes return 401 without a token, and 401 with a tampered JWT
- Protected routes return 200 with a valid JWT
- Admin routes return 403 without credentials, 403 with a user JWT, 403 with a wrong admin key
- Admin routes return 200 with the correct `x-admin-key` header
