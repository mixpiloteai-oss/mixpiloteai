# SESSION_ARCHITECTURE.md
## MixPiloteAI — Session Management Architecture
**Date:** 2026-05-27

---

## 1. Overview

MixPiloteAI uses a **multi-device session system** built on the `user_sessions` table. Each login creates an independent session record tied to a device fingerprint. Sessions can be inspected and revoked individually through the account settings UI.

---

## 2. Session Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│                      LOGIN FLOW                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Client                    Server                  Database  │
│  ──────                    ──────                  ────────  │
│    │                          │                       │      │
│    │── POST /auth/login ──────►│                       │      │
│    │   { email, password }     │                       │      │
│    │                           │── verify bcrypt ──────►│      │
│    │                           │◄── user record ────────│      │
│    │                           │                       │      │
│    │                           │  generateSecureToken() │      │
│    │                           │  = 32 random bytes     │      │
│    │                           │                       │      │
│    │                           │── INSERT user_sessions ►│      │
│    │                           │   refresh_token_hash,  │      │
│    │                           │   family_id (new UUID) │      │
│    │                           │   device_name/type,    │      │
│    │                           │   ip_address, expires  │      │
│    │                           │◄──────────────────────│      │
│    │                           │                       │      │
│    │◄── { accessToken,         │                       │      │
│    │      refreshToken }       │                       │      │
│    │                           │                       │      │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Token Rotation

Every use of the refresh token **replaces** it with a new one:

```
┌─────────────────────────────────────────────────────────────┐
│                   REFRESH TOKEN ROTATION                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Client              Server                    Database      │
│  ──────              ──────                    ────────      │
│    │                    │                          │         │
│    │── POST /refresh ───►│                          │         │
│    │   { refreshToken }  │                          │         │
│    │                     │── SHA-256(token) ────────►│         │
│    │                     │◄── session record ────────│         │
│    │                     │                          │         │
│    │                     │── revokeByTokenHash() ───►│         │
│    │                     │   (soft delete old token) │         │
│    │                     │                          │         │
│    │                     │   generateSecureToken()   │         │
│    │                     │   (new refresh token)     │         │
│    │                     │                          │         │
│    │                     │── INSERT new session ─────►│         │
│    │                     │   same family_id!         │         │
│    │                     │   new token_hash          │         │
│    │                     │   updated last_seen_at    │         │
│    │                     │◄──────────────────────────│         │
│    │                     │                          │         │
│    │◄── { new accessToken,│                          │         │
│    │     new refreshToken}│                          │         │
│    │                      │                          │         │
└─────────────────────────────────────────────────────────────┘
```

### Key invariants
1. The old token hash is **revoked before** the new token is issued
2. Both old and new sessions share the **same `family_id`**
3. `last_seen_at` is updated on every successful refresh

---

## 4. Token Theft Detection (Family Revocation)

If a stolen refresh token is replayed **after** it has already been rotated:

```
┌─────────────────────────────────────────────────────────────┐
│                  THEFT DETECTION FLOW                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Attacker            Server              Database            │
│  ───────             ──────              ────────            │
│    │                    │                    │               │
│    │── POST /refresh ───►│                    │               │
│    │  (old, rotated RT)  │                    │               │
│    │                     │── SHA-256 lookup ──►│               │
│    │                     │◄── NOT FOUND ───────│               │
│    │                     │                    │               │
│    │                     │  ⚠ THEFT DETECTED! │               │
│    │                     │                    │               │
│    │                     │── revokeFamily() ──►│               │
│    │                     │  (all sessions      │               │
│    │                     │   with same         │               │
│    │                     │   family_id)        │               │
│    │                     │◄───────────────────│               │
│    │                     │                    │               │
│    │◄── 401 UNAUTHORIZED │                    │               │
│    │                     │                    │               │
│  Legitimate User          │                    │               │
│    │                     │                    │               │
│    │── POST /refresh ────►│                    │               │
│    │  (current valid RT)  │── lookup ──────────►│               │
│    │                     │◄── REVOKED ─────────│               │
│    │◄── 401 TOKEN_EXPIRED │                    │               │
│    │   → forced re-login  │                    │               │
└─────────────────────────────────────────────────────────────┘
```

The legitimate user is forced to re-authenticate, becoming aware that their session was compromised. This is an intentional security trade-off.

---

## 5. Database Schema

```sql
CREATE TABLE public.user_sessions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- Token storage (hash only, never plaintext)
  refresh_token_hash TEXT NOT NULL UNIQUE,
  
  -- Rotation family for theft detection
  family_id         TEXT NOT NULL,
  
  -- Device fingerprint
  device_name       TEXT,                  -- "Chrome on macOS"
  device_type       TEXT DEFAULT 'browser'
                    CHECK (device_type IN ('browser','mobile','desktop','api')),
  ip_address        TEXT,                  -- stored full, masked in API response
  user_agent        TEXT,                  -- raw User-Agent header
  
  -- Timestamps
  last_seen_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at        TIMESTAMPTZ NOT NULL,
  
  -- Revocation
  revoked           BOOLEAN NOT NULL DEFAULT false,
  revoked_at        TIMESTAMPTZ,
  revoked_reason    TEXT                   -- 'logout' | 'password_change' |
                                           -- 'revoked_by_user' | 'theft_detected'
);

-- Performance indexes
CREATE INDEX ON user_sessions(refresh_token_hash);  -- O(1) token lookup
CREATE INDEX ON user_sessions(user_id, revoked);    -- session list per user
CREATE INDEX ON user_sessions(family_id);            -- family revocation
CREATE INDEX ON user_sessions(expires_at);           -- cleanup jobs
```

---

## 6. Device Detection

The `detectDevice()` function parses the `User-Agent` header to produce a human-readable session name:

```typescript
detectDevice("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120")
// → { deviceName: "Chrome on macOS", deviceType: "browser" }

detectDevice("MixPiloteAI-Desktop/2.1 (Windows NT 10.0)")
// → { deviceName: "MixPiloteAI Desktop on Windows", deviceType: "desktop" }

detectDevice("MixPiloteAI-Mobile/1.5 (iPhone OS 17)")
// → { deviceName: "MixPiloteAI Mobile on iOS", deviceType: "mobile" }

detectDevice(undefined)  // API key auth
// → { deviceName: "API Client", deviceType: "api" }
```

### Detection Rules
| UA Pattern | deviceType | deviceName Example |
|-----------|-----------|-------------------|
| `MixPiloteAI-Mobile` | `mobile` | "MixPiloteAI Mobile on iOS" |
| `MixPiloteAI-Desktop` | `desktop` | "MixPiloteAI Desktop on Windows" |
| `Android` | `mobile` | "Chrome on Android" |
| `iPhone` / `iPad` | `mobile` | "Safari on iOS" |
| No UA / `curl` / `axios` | `api` | "API Client" |
| Everything else | `browser` | "Firefox on Linux" |

---

## 7. Session API Endpoints

### `GET /api/auth/sessions`
Returns all active sessions for the authenticated user.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "deviceName": "Chrome on macOS",
      "deviceType": "browser",
      "ipAddress": "192.168.1.xxx",
      "lastSeenAt": 1748304000000,
      "createdAt": 1748217600000,
      "expiresAt": 1750896000000
    }
  ]
}
```

Note: The **first** session in the array is the current session (matched by refresh token from the request).

### `DELETE /api/auth/sessions/:id`
Revoke a specific session. Returns 403 if the session doesn't belong to the authenticated user. Cannot revoke the current session this way (use `/logout`).

### `DELETE /api/auth/sessions`
Revoke all sessions. The current session is also revoked; the client should clear tokens and redirect to login.

---

## 8. SessionsPanel UI Component

The `SessionsPanel` React component (`frontend/src/components/SessionsPanel.tsx`) provides the user-facing session management interface:

```
┌─────────────────────────────────────────────────┐
│  Active Sessions                 ↻ Refresh       │
│  3 active sessions          [Sign Out All]        │
├─────────────────────────────────────────────────┤
│  🌐  Chrome on macOS          [Current]          │
│      192.168.1.xxx  ·  Last active: just now     │
├─────────────────────────────────────────────────┤
│  📱  MixPiloteAI Mobile                          │
│      10.0.2.xxx  ·  Last active: 2h ago   [✕ Sign out] │
├─────────────────────────────────────────────────┤
│  🌐  Firefox on Windows                          │
│      172.16.0.xxx  ·  Last active: 3d ago [✕ Sign out] │
└─────────────────────────────────────────────────┘
│  🔒 Session tokens are hashed before storage...  │
```

### Features
- Real-time list from `GET /api/auth/sessions`
- Device type icons (🌐 browser, 📱 mobile, 🖥️ desktop, ⚙️ api)
- "Current" badge on the active session
- Per-session revocation with optimistic UI update
- Bulk "Sign Out All" with confirmation dialog
- Loading skeleton animation (3 placeholder cards)
- Toast notifications for success/error states
- Animated entry/exit via Framer Motion

---

## 9. Session Cleanup

Expired sessions are not automatically deleted (soft expiry via `expires_at` column). A periodic cleanup job should run:

```sql
-- Recommended: run daily via pg_cron or external scheduler
DELETE FROM user_sessions
WHERE expires_at < NOW() - INTERVAL '7 days'
   OR (revoked = true AND revoked_at < NOW() - INTERVAL '30 days');
```

The 7-day grace period after expiry allows audit trail retention.

---

## 10. Concurrency & Edge Cases

| Scenario | Behavior |
|----------|----------|
| Two concurrent refreshes | Second request gets 401 (first revoked the token) |
| Refresh after logout | 401 (session revoked) |
| Session already revoked | `findByTokenHash` returns null → 401 |
| Token hash collision | Statistically impossible (256-bit, UNIQUE constraint) |
| User deleted | CASCADE deletes all sessions |
| Clock skew | `expires_at` checked server-side, not trusted from JWT |

---

*Generated: 2026-05-27 | MixPiloteAI Auth Hardening — Mission 6*
