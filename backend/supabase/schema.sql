-- ============================================================
-- NEUROTEK AI — Complete Supabase Schema
-- Single source of truth for all PostgreSQL tables.
-- Safe to re-run (all statements are idempotent).
-- ============================================================

-- ── Extensions ───────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Core User Tables ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT        UNIQUE NOT NULL,
  name          TEXT        NOT NULL,
  password_hash TEXT        NOT NULL,
  plan          TEXT        NOT NULL DEFAULT 'free'
                            CHECK (plan IN ('free','pro','studio')),
  refresh_token TEXT,
  banned        BOOLEAN     NOT NULL DEFAULT false,
  ban_reason    TEXT,
  banned_at     TIMESTAMPTZ,
  banned_by     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.usage_log (
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  date    DATE NOT NULL DEFAULT CURRENT_DATE,
  count   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, date)
);

CREATE TABLE IF NOT EXISTS public.projects (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name         TEXT        NOT NULL,
  genre        TEXT        NOT NULL DEFAULT 'hardtek',
  bpm          INTEGER     NOT NULL DEFAULT 145,
  key          TEXT        NOT NULL DEFAULT 'Am',
  mood         TEXT        NOT NULL DEFAULT 'dark',
  tracks       JSONB       NOT NULL DEFAULT '[]',
  duration     NUMERIC     NOT NULL DEFAULT 0,
  is_starred   BOOLEAN     NOT NULL DEFAULT false,
  cover_color  TEXT        NOT NULL DEFAULT '#7c3aed',
  tags         TEXT[]      NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  plan                     TEXT        NOT NULL DEFAULT 'free',
  status                   TEXT        NOT NULL DEFAULT 'active'
                           CHECK (status IN ('active','cancelled','expired')),
  stripe_subscription_id   TEXT,
  stripe_customer_id       TEXT,
  current_period_start     TIMESTAMPTZ,
  current_period_end       TIMESTAMPTZ,
  cancel_at_period_end     BOOLEAN     NOT NULL DEFAULT false,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Templates ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.templates (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL,
  genre         TEXT        NOT NULL DEFAULT '',
  bpm           INTEGER     NOT NULL DEFAULT 145,
  mood          TEXT        NOT NULL DEFAULT '',
  description   TEXT        NOT NULL DEFAULT '',
  tracks        JSONB       NOT NULL DEFAULT '[]',
  ai_confidence NUMERIC(4,3) NOT NULL DEFAULT 0,
  generated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Packs ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.packs (
  id           TEXT        PRIMARY KEY,
  name         TEXT        NOT NULL,
  description  TEXT        NOT NULL DEFAULT '',
  type         TEXT        NOT NULL
               CHECK (type IN ('template','fx-rack','drum-kit','live-scene','preset','chain','ai-workflow')),
  genre        TEXT        NOT NULL DEFAULT '',
  author       TEXT        NOT NULL,
  author_plan  TEXT        NOT NULL DEFAULT 'free',
  downloads    INTEGER     NOT NULL DEFAULT 0,
  rating       NUMERIC(4,2) NOT NULL DEFAULT 0,
  rating_count INTEGER     NOT NULL DEFAULT 0,
  tags         TEXT[]      NOT NULL DEFAULT '{}',
  is_builtin   BOOLEAN     NOT NULL DEFAULT false,
  is_free      BOOLEAN     NOT NULL DEFAULT true,
  size         TEXT        NOT NULL DEFAULT '0 MB',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pack_comments (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id    TEXT        NOT NULL REFERENCES public.packs(id) ON DELETE CASCADE,
  user_id    TEXT        NOT NULL,
  user_name  TEXT        NOT NULL,
  content    TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Marketplace ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.marketplace_products (
  id             TEXT          PRIMARY KEY,
  slug           TEXT          UNIQUE NOT NULL,
  name           TEXT          NOT NULL,
  description    TEXT          NOT NULL DEFAULT '',
  category       TEXT          NOT NULL,
  tags           TEXT[]        NOT NULL DEFAULT '{}',
  creator_id     TEXT          NOT NULL,
  creator_name   TEXT          NOT NULL,
  price          INTEGER       NOT NULL DEFAULT 0,
  currency       TEXT          NOT NULL DEFAULT 'USD',
  file_size      BIGINT        NOT NULL DEFAULT 0,
  file_url       TEXT          NOT NULL DEFAULT '',
  preview_url    TEXT          NOT NULL DEFAULT '',
  cover_url      TEXT          NOT NULL DEFAULT '',
  bpm            INTEGER,
  key            TEXT,
  sample_count   INTEGER,
  status         TEXT          NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','approved','rejected','flagged')),
  downloads      INTEGER       NOT NULL DEFAULT 0,
  likes          INTEGER       NOT NULL DEFAULT 0,
  comment_count  INTEGER       NOT NULL DEFAULT 0,
  featured       BOOLEAN       NOT NULL DEFAULT false,
  trending_score NUMERIC(12,4) NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.marketplace_likes (
  product_id TEXT        NOT NULL REFERENCES public.marketplace_products(id) ON DELETE CASCADE,
  user_id    TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.marketplace_comments (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id TEXT        NOT NULL REFERENCES public.marketplace_products(id) ON DELETE CASCADE,
  user_id    TEXT        NOT NULL,
  user_name  TEXT        NOT NULL,
  text       TEXT        NOT NULL,
  rating     INTEGER     NOT NULL DEFAULT 5 CHECK (rating BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Teams & Invitations ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.teams (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL,
  owner_id   UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.team_members (
  team_id    UUID        NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL,
  user_name  TEXT        NOT NULL,
  email      TEXT        NOT NULL,
  role       TEXT        NOT NULL DEFAULT 'viewer'
             CHECK (role IN ('owner','editor','commenter','viewer')),
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.team_invitations (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     UUID        NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  email       TEXT        NOT NULL,
  role        TEXT        NOT NULL DEFAULT 'viewer',
  invited_by  UUID        NOT NULL,
  token       TEXT        UNIQUE NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  accepted    BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.project_permissions (
  project_id         UUID        PRIMARY KEY REFERENCES public.projects(id) ON DELETE CASCADE,
  team_id            UUID        NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  member_permissions JSONB       NOT NULL DEFAULT '{}'
);

-- ── Coupons ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.coupons (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code             TEXT        UNIQUE NOT NULL,
  type             TEXT        NOT NULL
                   CHECK (type IN ('percent_off','amount_off','trial_days')),
  value            NUMERIC     NOT NULL,
  applicable_plans TEXT[]      NOT NULL DEFAULT '{}',
  max_uses         INTEGER     NOT NULL DEFAULT -1,
  used_count       INTEGER     NOT NULL DEFAULT 0,
  expires_at       BIGINT      NOT NULL DEFAULT -1,
  active           BOOLEAN     NOT NULL DEFAULT true,
  description      TEXT        NOT NULL DEFAULT '',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.coupon_redemptions (
  coupon_code TEXT        NOT NULL,
  user_id     UUID        NOT NULL,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (coupon_code, user_id)
);

-- ── Project Versions ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.project_versions (
  id          TEXT        PRIMARY KEY,
  project_id  UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  label       TEXT        NOT NULL,
  type        TEXT        NOT NULL DEFAULT 'manual'
              CHECK (type IN ('manual','auto','pre-action')),
  size_bytes  INTEGER     NOT NULL DEFAULT 0,
  checksum    TEXT        NOT NULL,
  data        JSONB       NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Collaboration Rooms ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.collab_rooms (
  id          TEXT        PRIMARY KEY,
  project_id  UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  rev         INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_active TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Billing History ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.billing_history (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount              INTEGER     NOT NULL,
  currency            TEXT        NOT NULL DEFAULT 'USD',
  status              TEXT        NOT NULL DEFAULT 'succeeded'
                      CHECK (status IN ('succeeded','failed','refunded','pending')),
  provider            TEXT        NOT NULL DEFAULT 'stripe'
                      CHECK (provider IN ('stripe','paypal','manual')),
  provider_payment_id TEXT,
  description         TEXT        NOT NULL DEFAULT '',
  plan                TEXT,
  metadata            JSONB       NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Admin Tables ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_sessions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id      TEXT        NOT NULL,
  admin_email   TEXT        NOT NULL,
  refresh_token TEXT        UNIQUE NOT NULL,
  ip_address    TEXT,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ NOT NULL,
  revoked       BOOLEAN     NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.admin_logs (
  id          BIGSERIAL   PRIMARY KEY,
  admin_id    TEXT        NOT NULL,
  admin_email TEXT        NOT NULL,
  action      TEXT        NOT NULL,
  target      TEXT,
  details     JSONB,
  ip_address  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL,
  user_email  TEXT        NOT NULL,
  user_name   TEXT        NOT NULL,
  subject     TEXT        NOT NULL,
  body        TEXT        NOT NULL DEFAULT '',
  category    TEXT        NOT NULL DEFAULT 'general'
              CHECK (category IN ('billing','technical','abuse','general','refund')),
  status      TEXT        NOT NULL DEFAULT 'open'
              CHECK (status IN ('open','in_progress','resolved','closed')),
  priority    TEXT        NOT NULL DEFAULT 'medium'
              CHECK (priority IN ('low','medium','high','critical')),
  assigned_to TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ticket_messages (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id  UUID        NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  author     TEXT        NOT NULL,
  text       TEXT        NOT NULL,
  is_admin   BOOLEAN     NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.security_events (
  id         BIGSERIAL   PRIMARY KEY,
  type       TEXT        NOT NULL,
  severity   TEXT        NOT NULL DEFAULT 'low',
  ip         TEXT,
  user_id    TEXT,
  email      TEXT,
  route      TEXT,
  reason     TEXT,
  meta       JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.plugin_crashes (
  id           BIGSERIAL   PRIMARY KEY,
  user_id      TEXT,
  plugin_name  TEXT,
  plugin_path  TEXT,
  message      TEXT,
  stack        TEXT,
  app_version  TEXT,
  platform     TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_projects_user_id       ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_log_user_date    ON public.usage_log(user_id, date);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id  ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status   ON public.subscriptions(status);

CREATE INDEX IF NOT EXISTS idx_packs_genre            ON public.packs(genre);
CREATE INDEX IF NOT EXISTS idx_packs_type             ON public.packs(type);
CREATE INDEX IF NOT EXISTS idx_packs_downloads        ON public.packs(downloads DESC);

CREATE INDEX IF NOT EXISTS idx_market_category        ON public.marketplace_products(category);
CREATE INDEX IF NOT EXISTS idx_market_status          ON public.marketplace_products(status);
CREATE INDEX IF NOT EXISTS idx_market_trending        ON public.marketplace_products(trending_score DESC);
CREATE INDEX IF NOT EXISTS idx_market_featured        ON public.marketplace_products(featured) WHERE featured = true;

CREATE INDEX IF NOT EXISTS idx_teams_owner            ON public.teams(owner_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user      ON public.team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_invitations_token      ON public.team_invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_team       ON public.team_invitations(team_id);

CREATE INDEX IF NOT EXISTS idx_project_versions_proj  ON public.project_versions(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_collab_rooms_project   ON public.collab_rooms(project_id);
CREATE INDEX IF NOT EXISTS idx_collab_rooms_active    ON public.collab_rooms(last_active);

CREATE INDEX IF NOT EXISTS idx_billing_user           ON public.billing_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_billing_status         ON public.billing_history(status);

CREATE INDEX IF NOT EXISTS idx_tickets_status         ON public.support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_priority       ON public.support_tickets(priority);
CREATE INDEX IF NOT EXISTS idx_ticket_msgs            ON public.ticket_messages(ticket_id, created_at);
CREATE INDEX IF NOT EXISTS idx_admin_logs_admin       ON public.admin_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created     ON public.admin_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_ip     ON public.security_events(ip);
CREATE INDEX IF NOT EXISTS idx_security_events_type   ON public.security_events(type);

-- ── Functions ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.increment_usage(p_user_id UUID, p_date DATE)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.usage_log (user_id, date, count)
  VALUES (p_user_id, p_date, 1)
  ON CONFLICT (user_id, date)
  DO UPDATE SET count = usage_log.count + 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_trending_scores()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.marketplace_products
  SET trending_score = downloads * 2 + likes * 3 +
    GREATEST(0, 30 - EXTRACT(EPOCH FROM (now() - created_at)) / 86400) * 5;
END;
$$;

-- ── Row-Level Security ────────────────────────────────────────
DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'users','usage_log','projects','subscriptions','templates',
    'packs','pack_comments',
    'marketplace_products','marketplace_likes','marketplace_comments',
    'teams','team_members','team_invitations','project_permissions',
    'coupons','coupon_redemptions',
    'project_versions','collab_rooms',
    'billing_history',
    'admin_sessions','admin_logs','support_tickets','ticket_messages',
    'security_events','plugin_crashes'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = tbl AND policyname = 'service_role_all'
    ) THEN
      EXECUTE format(
        'CREATE POLICY service_role_all ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
        tbl
      );
    END IF;
  END LOOP;
END $$;

-- ── Demo Accounts ─────────────────────────────────────────────
INSERT INTO public.users (id, email, name, password_hash, plan)
VALUES
  ('00000000-0000-0000-0000-000000000001','free@neurotek.ai',   'Free Producer',   '$2a$10$8nbCJR5WS0m6VEPOLCfT0Oee0/4brvTDLEe7mlOL.X7ZAQiHEpfR6','free'),
  ('00000000-0000-0000-0000-000000000002','pro@neurotek.ai',    'Pro Producer',    '$2a$10$8nbCJR5WS0m6VEPOLCfT0Oee0/4brvTDLEe7mlOL.X7ZAQiHEpfR6','pro'),
  ('00000000-0000-0000-0000-000000000003','studio@neurotek.ai', 'Studio Producer', '$2a$10$8nbCJR5WS0m6VEPOLCfT0Oee0/4brvTDLEe7mlOL.X7ZAQiHEpfR6','studio')
ON CONFLICT (email) DO NOTHING;

INSERT INTO public.subscriptions (user_id, plan, status)
VALUES
  ('00000000-0000-0000-0000-000000000001','free',   'active'),
  ('00000000-0000-0000-0000-000000000002','pro',    'active'),
  ('00000000-0000-0000-0000-000000000003','studio', 'active')
ON CONFLICT DO NOTHING;
