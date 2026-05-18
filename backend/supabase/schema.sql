-- NeuroTek AI — Supabase Schema
-- Run once in: Supabase Dashboard → SQL Editor → New query
-- Safe to re-run (all statements are idempotent).

-- ── Extensions ───────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Tables ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT        UNIQUE NOT NULL,
  name          TEXT        NOT NULL,
  password_hash TEXT        NOT NULL,
  plan          TEXT        NOT NULL DEFAULT 'free'
                            CHECK (plan IN ('free', 'pro', 'studio')),
  refresh_token TEXT,
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

-- ── Indexes ───────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_projects_user_id   ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_log_user_date ON public.usage_log(user_id, date);

-- ── Functions ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.increment_usage(p_user_id UUID, p_date DATE)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.usage_log (user_id, date, count)
  VALUES (p_user_id, p_date, 1)
  ON CONFLICT (user_id, date)
  DO UPDATE SET count = usage_log.count + 1;
END;
$$;

-- ── Row-Level Security ────────────────────────────────────────
-- The backend uses the service_role key which bypasses RLS.
-- RLS is enabled so that accidental anon/public access is blocked.

ALTER TABLE public.users     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects  ENABLE ROW LEVEL SECURITY;

-- Allow service_role full access (needed for some Supabase versions)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'users' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON public.users
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'usage_log' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON public.usage_log
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'projects' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON public.projects
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ── Demo Accounts ─────────────────────────────────────────────
-- Password for all demo accounts: demo1234
-- Hash generated with bcrypt cost=10.

INSERT INTO public.users (id, email, name, password_hash, plan)
VALUES
  (
    '00000000-0000-0000-0000-000000000001',
    'free@neurotek.ai',
    'Free Producer',
    '$2a$10$8nbCJR5WS0m6VEPOLCfT0Oee0/4brvTDLEe7mlOL.X7ZAQiHEpfR6',
    'free'
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    'pro@neurotek.ai',
    'Pro Producer',
    '$2a$10$8nbCJR5WS0m6VEPOLCfT0Oee0/4brvTDLEe7mlOL.X7ZAQiHEpfR6',
    'pro'
  ),
  (
    '00000000-0000-0000-0000-000000000003',
    'studio@neurotek.ai',
    'Studio Producer',
    '$2a$10$8nbCJR5WS0m6VEPOLCfT0Oee0/4brvTDLEe7mlOL.X7ZAQiHEpfR6',
    'studio'
  )
ON CONFLICT (email) DO NOTHING;
