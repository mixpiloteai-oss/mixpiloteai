-- ============================================================
-- Migration 007: Persistent collaboration engine
-- ============================================================

-- Persistent operation log (append-only, survives restart)
CREATE TABLE IF NOT EXISTS public.collab_ops (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id       TEXT        NOT NULL REFERENCES public.collab_rooms(id) ON DELETE CASCADE,
  project_id    UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  op_id         TEXT        NOT NULL UNIQUE,   -- client-supplied stable ID
  rev           INTEGER     NOT NULL,
  op_type       TEXT        NOT NULL,
  payload       JSONB       NOT NULL DEFAULT '{}',
  user_id       TEXT        NOT NULL,
  user_name     TEXT        NOT NULL,
  user_color    TEXT        NOT NULL DEFAULT '#8b5cf6',
  client_rev    INTEGER     NOT NULL DEFAULT 0,
  timestamp     BIGINT      NOT NULL,
  committed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(room_id, rev)
);

CREATE INDEX IF NOT EXISTS idx_collab_ops_room_rev ON public.collab_ops(room_id, rev);
CREATE INDEX IF NOT EXISTS idx_collab_ops_project  ON public.collab_ops(project_id);
CREATE INDEX IF NOT EXISTS idx_collab_ops_user     ON public.collab_ops(user_id);

-- Room state snapshots (fast recovery without replaying 500 ops)
CREATE TABLE IF NOT EXISTS public.collab_snapshots (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id      TEXT    NOT NULL REFERENCES public.collab_rooms(id) ON DELETE CASCADE,
  project_id   UUID    NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  rev          INTEGER NOT NULL,
  state        JSONB   NOT NULL DEFAULT '{}',
  ops_count    INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_collab_snapshots_room ON public.collab_snapshots(room_id, rev DESC);

-- Persistent presence (last known cursor state per user per room)
CREATE TABLE IF NOT EXISTS public.collab_presence (
  room_id    TEXT    NOT NULL,
  user_id    TEXT    NOT NULL,
  user_name  TEXT    NOT NULL,
  user_color TEXT    NOT NULL DEFAULT '#8b5cf6',
  cursor_bar   INTEGER,
  cursor_track TEXT,
  last_seen  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_collab_presence_room ON public.collab_presence(room_id);

-- Persistent sync deduplication (replaces in-memory Set that resets on restart)
CREATE TABLE IF NOT EXISTS public.sync_dedup (
  op_id        TEXT PRIMARY KEY,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sync_dedup_processed ON public.sync_dedup(processed_at);

-- Extend collab_rooms with snapshot tracking
ALTER TABLE public.collab_rooms
  ADD COLUMN IF NOT EXISTS snapshot_rev   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_rev        INTEGER NOT NULL DEFAULT 0;

-- RLS: service role only for all collab tables
ALTER TABLE public.collab_ops       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collab_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collab_presence  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_dedup       ENABLE ROW LEVEL SECURITY;
