-- NeuroTek AI — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New query

-- Users table
CREATE TABLE IF NOT EXISTS public.users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  plan          TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'studio')),
  refresh_token TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Usage tracking table
CREATE TABLE IF NOT EXISTS public.usage_log (
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  date    DATE NOT NULL DEFAULT CURRENT_DATE,
  count   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, date)
);

-- Projects table
CREATE TABLE IF NOT EXISTS public.projects (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  genre        TEXT NOT NULL DEFAULT 'hardtek',
  bpm          INTEGER NOT NULL DEFAULT 145,
  key          TEXT NOT NULL DEFAULT 'Am',
  mood         TEXT NOT NULL DEFAULT 'dark',
  tracks       JSONB NOT NULL DEFAULT '[]',
  duration     NUMERIC NOT NULL DEFAULT 0,
  is_starred   BOOLEAN NOT NULL DEFAULT false,
  cover_color  TEXT NOT NULL DEFAULT '#7c3aed',
  tags         TEXT[] NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Helper function for atomic usage increment
CREATE OR REPLACE FUNCTION public.increment_usage(p_user_id UUID, p_date DATE)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.usage_log (user_id, date, count)
  VALUES (p_user_id, p_date, 1)
  ON CONFLICT (user_id, date)
  DO UPDATE SET count = usage_log.count + 1;
END;
$$;

-- Row-level security (service role key bypasses RLS — backend uses service role)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_log_user_date ON public.usage_log(user_id, date);
