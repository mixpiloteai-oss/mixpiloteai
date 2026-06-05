-- ============================================================
-- NEUROTEK AI — Migration 005: Production Billing Tables
-- Replaces all in-memory billing stores with PostgreSQL persistence.
-- Run with: psql $DATABASE_URL < migrations/005_billing_complete.sql
-- ============================================================

-- ── 1. Invoices ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number              TEXT NOT NULL UNIQUE,          -- INV-2024-00001
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  customer_name       TEXT NOT NULL DEFAULT '',
  customer_email      TEXT NOT NULL DEFAULT '',
  customer_address    JSONB NOT NULL DEFAULT '{}',
  vat_number          TEXT,
  line_items          JSONB NOT NULL DEFAULT '[]',
  subtotal_cents      INTEGER NOT NULL DEFAULT 0,
  vat_cents           INTEGER NOT NULL DEFAULT 0,
  vat_rate            NUMERIC(5,4) NOT NULL DEFAULT 0,
  total_cents         INTEGER NOT NULL DEFAULT 0,
  currency            TEXT NOT NULL DEFAULT 'USD',
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('paid','pending','void','refunded')),
  payment_method      TEXT NOT NULL DEFAULT 'stripe'
                        CHECK (payment_method IN ('stripe','paypal')),
  payment_intent_id   TEXT,
  paypal_order_id     TEXT,
  period_start        BIGINT,        -- unix ms
  period_end          BIGINT,        -- unix ms
  paid_at             BIGINT,        -- unix ms
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS invoices_user_id_idx    ON invoices(user_id);
CREATE INDEX IF NOT EXISTS invoices_status_idx     ON invoices(status);
CREATE INDEX IF NOT EXISTS invoices_created_at_idx ON invoices(created_at DESC);

-- Invoice number sequence (unique per year)
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1;

-- ── 2. Payment Events (replaces paymentLogService in-memory) ──
CREATE TABLE IF NOT EXISTS payment_events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID,          -- nullable for anonymous events
  event_type          TEXT NOT NULL,
  amount_cents        INTEGER,
  currency            TEXT DEFAULT 'usd',
  payment_method      TEXT CHECK (payment_method IN ('stripe','paypal','manual')),
  plan_id             TEXT,
  product_id          TEXT,
  coupon_code         TEXT,
  stripe_session_id   TEXT,
  stripe_intent_id    TEXT,
  paypal_order_id     TEXT,
  ip_address          TEXT,
  success             BOOLEAN NOT NULL DEFAULT TRUE,
  error_message       TEXT,
  metadata            JSONB DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS payment_events_user_id_idx    ON payment_events(user_id);
CREATE INDEX IF NOT EXISTS payment_events_created_at_idx ON payment_events(created_at DESC);
CREATE INDEX IF NOT EXISTS payment_events_success_idx    ON payment_events(success);

-- ── 3. Webhook Events (idempotency / replay attack protection) ─
CREATE TABLE IF NOT EXISTS webhook_events (
  id              TEXT PRIMARY KEY,   -- Stripe event ID or PayPal transmission_id
  provider        TEXT NOT NULL CHECK (provider IN ('stripe','paypal')),
  event_type      TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'processed'
                    CHECK (status IN ('processed','failed','skipped')),
  payload         JSONB,
  error_message   TEXT,
  processed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS webhook_events_provider_idx   ON webhook_events(provider);
CREATE INDEX IF NOT EXISTS webhook_events_created_at_idx ON webhook_events(processed_at DESC);

-- ── 4. Idempotency Keys (anti double-charge for client requests) ─
CREATE TABLE IF NOT EXISTS idempotency_keys (
  key             TEXT PRIMARY KEY,  -- client-provided UUID
  user_id         UUID NOT NULL,
  endpoint        TEXT NOT NULL,
  response_status INTEGER NOT NULL,
  response_body   JSONB NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours')
);

CREATE INDEX IF NOT EXISTS idempotency_keys_user_id_idx  ON idempotency_keys(user_id);
CREATE INDEX IF NOT EXISTS idempotency_keys_expires_idx  ON idempotency_keys(expires_at);

-- Auto-clean expired keys daily (pg_cron or manual cleanup)
-- SELECT cron.schedule('cleanup-idempotency-keys', '0 3 * * *',
--   $$DELETE FROM idempotency_keys WHERE expires_at < NOW()$$);

-- ── 5. Subscription table additions ───────────────────────────
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS paypal_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS paypal_order_id        TEXT,
  ADD COLUMN IF NOT EXISTS stripe_customer_id     TEXT,
  ADD COLUMN IF NOT EXISTS trial_end              BIGINT,
  ADD COLUMN IF NOT EXISTS cancel_at              BIGINT;

-- ── 6. RLS Policies ──────────────────────────────────────────
ALTER TABLE invoices          ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_events    ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events    ENABLE ROW LEVEL SECURITY;
ALTER TABLE idempotency_keys  ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS
CREATE POLICY "service_role_invoices"         ON invoices         FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_payment_events"   ON payment_events   FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_webhook_events"   ON webhook_events   FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_idempotency_keys" ON idempotency_keys FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Users can read their own invoices and payment events
CREATE POLICY "users_read_own_invoices"        ON invoices       FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "users_read_own_payment_events"  ON payment_events FOR SELECT TO authenticated USING (user_id = auth.uid());

-- ── 7. Billing History backfill index ─────────────────────────
CREATE INDEX IF NOT EXISTS billing_history_user_created_idx
  ON billing_history(user_id, created_at DESC);
