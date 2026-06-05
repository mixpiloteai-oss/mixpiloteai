-- ============================================================
-- NEUROTEK AI — Security Events Table
-- ============================================================
-- Persists structured security events (auth failures, rate-limit
-- hits, suspicious IPs, payment attempts, CORS rejections, etc.)
-- so that analysts can review trends and trigger alerts.
-- ============================================================

CREATE TABLE IF NOT EXISTS security_events (
  id         BIGSERIAL PRIMARY KEY,
  type       TEXT NOT NULL,
  severity   TEXT NOT NULL,
  ip         TEXT,
  user_id    TEXT,
  email      TEXT,
  route      TEXT,
  reason     TEXT,
  meta       JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_events_type       ON security_events(type);
CREATE INDEX IF NOT EXISTS idx_security_events_ip         ON security_events(ip);
CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON security_events(created_at DESC);
