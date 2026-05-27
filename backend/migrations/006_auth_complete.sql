-- ============================================================
-- Migration 006: Complete Auth System
-- Adds: password_reset_tokens, email_verification_tokens,
--       user_sessions (multi-device), email_verified on users
-- ============================================================

-- ── Users: add email_verified columns ────────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS email_verified    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;

-- Mark existing users as verified (they registered before verification existed)
UPDATE public.users SET email_verified = true WHERE email_verified IS NULL OR email_verified = false;

-- ── Password reset tokens ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  email       TEXT        NOT NULL,
  token_hash  TEXT        NOT NULL UNIQUE,   -- SHA-256 of the plaintext token
  expires_at  TIMESTAMPTZ NOT NULL,
  used        BOOLEAN     NOT NULL DEFAULT false,
  used_at     TIMESTAMPTZ,
  ip_address  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prt_email      ON public.password_reset_tokens(email);
CREATE INDEX IF NOT EXISTS idx_prt_token_hash ON public.password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_prt_user_id    ON public.password_reset_tokens(user_id);

-- ── Email verification tokens ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.email_verification_tokens (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  email       TEXT        NOT NULL,
  token_hash  TEXT        NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  used        BOOLEAN     NOT NULL DEFAULT false,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_evt_user_id    ON public.email_verification_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_evt_token_hash ON public.email_verification_tokens(token_hash);

-- ── User sessions (multi-device) ──────────────────────────────
-- Replaces single refresh_token column on users for multi-device support.
-- users.refresh_token kept for backward-compat (in-memory fallback).
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  refresh_token_hash TEXT        NOT NULL UNIQUE,
  family_id          TEXT        NOT NULL,               -- for token-reuse theft detection
  device_name        TEXT,                               -- "Chrome on macOS"
  device_type        TEXT        DEFAULT 'browser'       -- browser | mobile | desktop | api
    CHECK (device_type IN ('browser', 'mobile', 'desktop', 'api')),
  ip_address         TEXT,
  user_agent         TEXT,
  last_seen_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at         TIMESTAMPTZ NOT NULL,
  revoked            BOOLEAN     NOT NULL DEFAULT false,
  revoked_at         TIMESTAMPTZ,
  revoked_reason     TEXT                               -- 'logout'|'logout-all'|'theft'|'expired'
);

CREATE INDEX IF NOT EXISTS idx_us_user_id    ON public.user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_us_token_hash ON public.user_sessions(refresh_token_hash);
CREATE INDEX IF NOT EXISTS idx_us_family     ON public.user_sessions(family_id);

-- ── RLS Policies ──────────────────────────────────────────────

-- password_reset_tokens: service_role only (never exposed to end user)
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS prt_service_role ON public.password_reset_tokens;
CREATE POLICY prt_service_role ON public.password_reset_tokens
  USING (auth.role() = 'service_role');

-- email_verification_tokens: service_role only
ALTER TABLE public.email_verification_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS evt_service_role ON public.email_verification_tokens;
CREATE POLICY evt_service_role ON public.email_verification_tokens
  USING (auth.role() = 'service_role');

-- user_sessions: service_role can do anything; users read own sessions
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS us_service_role ON public.user_sessions;
CREATE POLICY us_service_role ON public.user_sessions
  USING (auth.role() = 'service_role');
DROP POLICY IF EXISTS us_user_read ON public.user_sessions;
CREATE POLICY us_user_read ON public.user_sessions
  FOR SELECT USING (user_id::text = auth.uid()::text);

-- ── Auto-cleanup: remove expired / used tokens after 7 days ──
-- (In production, run a pg_cron job or schedule a cleanup Lambda)
-- Example cron (every day at 03:00 UTC):
-- SELECT cron.schedule('cleanup-auth-tokens', '0 3 * * *', $$
--   DELETE FROM password_reset_tokens WHERE expires_at < now() - interval '7 days';
--   DELETE FROM email_verification_tokens WHERE expires_at < now() - interval '7 days';
--   DELETE FROM user_sessions WHERE expires_at < now() OR
--     (revoked = true AND revoked_at < now() - interval '7 days');
-- $$);
