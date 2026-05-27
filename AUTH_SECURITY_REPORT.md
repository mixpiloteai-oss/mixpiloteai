# AUTH_SECURITY_REPORT.md
## MixPiloteAI — Authentication Security Report
### Classification: Internal Security Documentation
**Date:** 2026-05-27  
**Scope:** Full authentication & session management system

---

## 1. Overview

The authentication system has been hardened to production-grade SaaS standards. This report documents all security controls, threat mitigations, and implementation decisions across the auth stack.

---

## 2. Password Security

### 2.1 Hashing
| Property | Value |
|----------|-------|
| Algorithm | bcrypt |
| Salt rounds | 10 |
| Output | 60-char hash, stored in `users.password_hash` |
| Plaintext stored | **Never** |

### 2.2 Password Strength Requirements
- Minimum 8 characters (enforced both client and server)
- Frontend StrengthBar component provides real-time strength feedback (5 levels)
- Checks: length ≥ 8, uppercase, digit, special character, length ≥ 12

### 2.3 Password Change
- Requires current password verification before accepting new password
- On success: all _other_ sessions are revoked (current session preserved)
- Security alert email sent with IP address and timestamp
- Endpoint: `POST /api/auth/change-password` (requires auth)

---

## 3. Password Reset System

### 3.1 Token Generation
```
Token = crypto.randomBytes(32).toString('hex')  // 256 bits of entropy, 64 hex chars
Stored = SHA-256(token)                          // only hash stored in DB
```
The plaintext token is sent by email once and **never stored**. Even a full DB dump cannot be used to reset passwords.

### 3.2 Token Lifecycle
```
[Request] → generate token → hash → store hash + expiry → email plaintext token
[Reset]   → hash incoming token → DB lookup → validate (not used, not expired)
         → markUsed() FIRST → updatePassword() → revokeAllSessions() → alert email
```

`markUsed()` is called **before** any side effects. This prevents race conditions where two parallel requests could both succeed with the same token.

### 3.3 Token Properties
| Property | Value |
|----------|-------|
| Entropy | 256 bits |
| Format | 64-char hex string |
| Storage | SHA-256 hash only |
| Expiry | 60 minutes |
| One-time use | Yes (used=true after first consumption) |
| Error code on failure | `INVALID_RESET_TOKEN` |

### 3.4 Anti-Enumeration
`POST /api/auth/forgot-password` always returns HTTP 200 with the same response body regardless of whether the email exists. This prevents attackers from enumerating valid accounts.

### 3.5 Anti-Flood (Email Flooding Protection)
- Maximum 3 reset emails per email address per hour
- Tracked in `password_reset_tokens` table via `countRecentForEmail(email, 3600000)`
- Returns HTTP 429 with `code: 'RESET_EMAIL_FLOOD'` if exceeded
- Separate from general rate limiter — per-address, not per-IP

### 3.6 Replay Attack Prevention
1. Token hash has `UNIQUE` constraint in DB → duplicate inserts fail
2. `used` column set to `true` before any side effects
3. `findValid()` checks `used = false AND expires_at > NOW()`
4. Even in a race condition, the second request gets `null` from `findValid()`

---

## 4. JWT Security

### 4.1 Token Architecture
| Token | TTL | Storage | Purpose |
|-------|-----|---------|---------|
| Access Token | 15 minutes (env: `JWT_ACCESS_EXPIRES`) | Memory only | API authorization |
| Refresh Token | 30 days (env: `JWT_REFRESH_EXPIRES`) | HTTP-only cookie / localStorage | Session renewal |

### 4.2 Refresh Token Rotation
Every token refresh issues a **new refresh token** and invalidates the old one:
```
Client sends: old_refresh_token
Server:
  1. findByTokenHash(SHA-256(old_refresh_token))
  2. If not found → revokeFamily() (theft detection)
  3. If found → revokeByTokenHash(old_token) + create new session
  4. Return: new_access_token + new_refresh_token
```

### 4.3 Token Family (Theft Detection)
Sessions are grouped by `family_id` (UUID assigned at login). If a **previously rotated** refresh token is presented:
- The token hash is no longer in `user_sessions` (was deleted on rotation)
- BUT the family_id is known → **entire family is revoked**
- This detects refresh token theft: if attacker replays an old token, the legitimate user's active session is also killed, alerting them on next use

### 4.4 JWT Signing
- Algorithm: HS256 (configurable via `JWT_ALGORITHM`)
- Secret: `JWT_SECRET` (minimum 32 chars recommended)
- Claims: `{ sub: userId, email, name, plan, iat, exp }`
- Verification: `jwt.verify()` on every authenticated request

---

## 5. Session Management

### 5.1 Multi-Device Sessions
Each login creates a record in `user_sessions` table. Users can view and revoke individual sessions from their account settings.

### 5.2 Session Record Fields
| Field | Description |
|-------|-------------|
| `id` | UUID primary key |
| `user_id` | Owner reference |
| `refresh_token_hash` | SHA-256 of refresh token |
| `family_id` | Token rotation family |
| `device_name` | Human-readable: "Chrome on macOS" |
| `device_type` | `browser` \| `mobile` \| `desktop` \| `api` |
| `ip_address` | Last seen IP (last octet masked in UI) |
| `last_seen_at` | Updated on token refresh |
| `expires_at` | Hard expiry |
| `revoked` | Soft-delete flag |
| `revoked_reason` | `logout` \| `password_change` \| `revoked_by_user` \| `theft_detected` |

### 5.3 Session Revocation Triggers
| Event | Sessions Revoked |
|-------|-----------------|
| Logout | Current session only |
| Password reset | **All** sessions |
| Password change | All **other** sessions |
| Token reuse detected | Entire family |
| Admin revoke | Specific session |
| User "Sign Out All" | All sessions |

### 5.4 IP Address Privacy
IP addresses are stored internally but the last octet is replaced with `xxx` in the sessions API response:
```
Stored:   192.168.1.42
Displayed: 192.168.1.xxx
```

---

## 6. Email Verification

### 6.1 Flow
1. Registration → verification email sent automatically
2. Token stored as SHA-256 hash, expires in 24 hours
3. Previous unverified tokens invalidated on resend
4. `POST /api/auth/verify-email` → marks `users.email_verified = true`
5. `POST /api/auth/resend-verification` → max 3 resends per user per hour

### 6.2 Token Properties
| Property | Value |
|----------|-------|
| Entropy | 256 bits |
| Expiry | 24 hours |
| One-time use | Yes |
| Re-request limit | 3 per hour |

---

## 7. Rate Limiting

### 7.1 Rate Limiter Configuration
| Limiter | Window | Max Requests | Key |
|---------|--------|--------------|-----|
| `authRateLimiter` | 15 min | 20 (5000 in test) | IP |
| `aiRateLimiter` | 1 min | Plan-based (5/30/100) | User ID |
| `generalRateLimiter` | 15 min | 300 | IP |
| `paymentsRateLimiter` | 1 min | 10 | User or IP |
| `marketplaceRateLimiter` | 1 min | 60 | User or IP |
| `uploadRateLimiter` | 1 hr | 20 | User or IP |
| `pluginRateLimiter` | 1 hr | 30 | User or IP |

### 7.2 Brute Force Protection
- Login: `authRateLimiter` → 20 attempts/15min → 15min lockout
- Forgot password: `authRateLimiter` + per-address flood check (3/hr)
- Reset password: `authRateLimiter` + token one-time-use (replay impossible)
- All limits: logged as `rate_limited` security event with IP + route

### 7.3 Security Event Logging
All rate limit hits are logged via `logSecurityEvent()` with:
- Event type, severity level
- IP address, user ID (if authenticated)
- Route, reason (limit value exceeded)

---

## 8. Email Service Security

### 8.1 Provider Selection (Priority Order)
1. **Resend** — if `RESEND_API_KEY` is set
2. **SendGrid** — if `SENDGRID_API_KEY` is set
3. **SMTP** — if `SMTP_HOST` is set
4. **Console fallback** — logs to stdout (dev only)

### 8.2 Anti-Flood (Service Level)
Independent from DB-level flood check. In-memory Map tracking `{ count, windowStart }` per address:
- Max 3 emails per address per hour
- Resets automatically after window expires
- Covers all email types (reset, verification, security alerts)

### 8.3 Security Alert Emails
Sent automatically after:
- Password reset (with IP of requestor)
- Password change (with IP of requestor)

Content: event type, timestamp, IP address, "if this wasn't you" guidance.

---

## 9. Database Security

### 9.1 Row-Level Security (RLS)
All new tables have RLS enabled with policies:
- `password_reset_tokens`: Service role only (no direct client access)
- `email_verification_tokens`: Service role only
- `user_sessions`: Users can only read their own sessions via `auth.uid() = user_id`

### 9.2 Indexes
```sql
-- Fast token lookups
CREATE INDEX ON password_reset_tokens(token_hash);
CREATE INDEX ON password_reset_tokens(email, created_at);
CREATE INDEX ON email_verification_tokens(token_hash);
CREATE INDEX ON user_sessions(refresh_token_hash);
CREATE INDEX ON user_sessions(user_id, revoked);
CREATE INDEX ON user_sessions(family_id);
CREATE INDEX ON user_sessions(expires_at);
```

### 9.3 Cascading Deletes
All token/session tables use `ON DELETE CASCADE` on `user_id` foreign key. Deleting a user automatically purges all their tokens and sessions.

---

## 10. Threat Model Summary

| Threat | Mitigation |
|--------|-----------|
| Password brute force | Rate limiting (20 req/15min), account lockout |
| Credential stuffing | Same rate limiting, bcrypt slow comparison |
| Reset token theft | 256-bit entropy, SHA-256 hash storage, 1hr expiry |
| Replay attack | One-time use tokens, markUsed() before side effects |
| Token enumeration | Email enumeration prevention (always 200) |
| Session hijacking | Refresh token rotation, family revocation |
| Email flooding | Per-address 3/hr limit at DB and service level |
| XSS token theft | Access token in memory only (not localStorage ideally) |
| CSRF | JWT bearer token (not cookie-based by default) |
| DB compromise | Passwords hashed (bcrypt), tokens hashed (SHA-256) |
| Man-in-the-middle | HTTPS enforced in production |

---

## 11. Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `JWT_SECRET` | JWT signing secret | *(required)* |
| `JWT_ACCESS_EXPIRES` | Access token TTL | `15m` |
| `JWT_REFRESH_EXPIRES` | Refresh token TTL | `30d` |
| `RESEND_API_KEY` | Resend email provider | — |
| `SENDGRID_API_KEY` | SendGrid email provider | — |
| `SMTP_HOST` | SMTP email provider | — |
| `APP_URL` | Base URL for email links | `http://localhost:3000` |
| `FROM_EMAIL` | Sender address | `noreply@mixpiloteai.com` |
| `RATE_LIMIT_WINDOW_MS` | AI rate limit window | `60000` |
| `RATE_LIMIT_MAX_FREE` | AI requests/window (free) | `5` |
| `RATE_LIMIT_MAX_PRO` | AI requests/window (pro) | `30` |
| `RATE_LIMIT_MAX_STUDIO` | AI requests/window (studio) | `100` |

---

## 12. Compliance Notes

- **GDPR**: Passwords never stored in plaintext. IP addresses masked in UI. Session data deletable via user account or cascade on user deletion.
- **SOC 2 Type II**: Security events logged with actor, action, resource, timestamp, IP.
- **OWASP Top 10**: Mitigations for A01 (Broken Access Control), A02 (Crypto Failures), A03 (Injection via parameterized queries), A07 (Identification Failures).

---

*Generated: 2026-05-27 | MixPiloteAI Auth Hardening — Mission 6*
