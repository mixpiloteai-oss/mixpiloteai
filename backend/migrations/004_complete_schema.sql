-- ============================================================
-- NEUROTEK AI — Migration 004: Complete Schema
-- Adds all missing tables for full PostgreSQL persistence.
-- Safe to re-run (idempotent via CREATE IF NOT EXISTS).
-- ============================================================

-- ── Templates ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.templates (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT          NOT NULL,
  genre         TEXT          NOT NULL DEFAULT '',
  bpm           INTEGER       NOT NULL DEFAULT 145,
  mood          TEXT          NOT NULL DEFAULT '',
  description   TEXT          NOT NULL DEFAULT '',
  tracks        JSONB         NOT NULL DEFAULT '[]',
  ai_confidence NUMERIC(4,3)  NOT NULL DEFAULT 0,
  generated_at  TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- ── Packs ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.packs (
  id           TEXT        PRIMARY KEY,
  name         TEXT        NOT NULL,
  description  TEXT        NOT NULL DEFAULT '',
  type         TEXT        NOT NULL
               CHECK (type IN ('template','fx-rack','drum-kit','live-scene','preset','chain','ai-workflow')),
  genre        TEXT        NOT NULL DEFAULT '',
  author       TEXT        NOT NULL,
  author_plan  TEXT        NOT NULL DEFAULT 'free'
               CHECK (author_plan IN ('free','pro','studio')),
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
  rating     INTEGER     NOT NULL DEFAULT 5
             CHECK (rating BETWEEN 1 AND 5),
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

-- ── Support Tickets ───────────────────────────────────────────
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

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_packs_genre      ON public.packs(genre);
CREATE INDEX IF NOT EXISTS idx_packs_type       ON public.packs(type);
CREATE INDEX IF NOT EXISTS idx_packs_downloads  ON public.packs(downloads DESC);

CREATE INDEX IF NOT EXISTS idx_market_category  ON public.marketplace_products(category);
CREATE INDEX IF NOT EXISTS idx_market_status    ON public.marketplace_products(status);
CREATE INDEX IF NOT EXISTS idx_market_trending  ON public.marketplace_products(trending_score DESC);
CREATE INDEX IF NOT EXISTS idx_market_featured  ON public.marketplace_products(featured) WHERE featured = true;

CREATE INDEX IF NOT EXISTS idx_teams_owner      ON public.teams(owner_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON public.team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON public.team_invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_team  ON public.team_invitations(team_id);

CREATE INDEX IF NOT EXISTS idx_project_versions_project ON public.project_versions(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_collab_rooms_project      ON public.collab_rooms(project_id);
CREATE INDEX IF NOT EXISTS idx_collab_rooms_last_active  ON public.collab_rooms(last_active);

CREATE INDEX IF NOT EXISTS idx_billing_user     ON public.billing_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_billing_status   ON public.billing_history(status);

CREATE INDEX IF NOT EXISTS idx_tickets_status   ON public.support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON public.support_tickets(priority);
CREATE INDEX IF NOT EXISTS idx_ticket_msgs      ON public.ticket_messages(ticket_id, created_at);

-- ── Row-Level Security ────────────────────────────────────────
ALTER TABLE public.templates             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.packs                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pack_comments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_products  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_likes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_comments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_invitations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_permissions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_redemptions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_versions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collab_rooms          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_history       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_messages       ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'templates','packs','pack_comments',
    'marketplace_products','marketplace_likes','marketplace_comments',
    'teams','team_members','team_invitations','project_permissions',
    'coupons','coupon_redemptions',
    'project_versions','collab_rooms',
    'billing_history',
    'support_tickets','ticket_messages'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
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

-- ── Helper Functions ──────────────────────────────────────────

-- Update trending score: call periodically via cron or pg_cron
CREATE OR REPLACE FUNCTION public.refresh_trending_scores()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.marketplace_products
  SET trending_score = downloads * 2 + likes * 3 +
    GREATEST(0, 30 - EXTRACT(EPOCH FROM (now() - created_at)) / 86400) * 5;
END;
$$;

-- Rollback helper: soft-delete a migration step (example pattern)
-- To rollback migration 004: DROP tables in reverse dependency order.
-- Script: backend/scripts/rollback_004.sql
