CREATE TABLE IF NOT EXISTS plugin_crashes (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT,
  plugin_name TEXT NOT NULL,
  plugin_path TEXT,
  message TEXT,
  stack TEXT,
  app_version TEXT,
  platform TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_plugin_crashes_name ON plugin_crashes(plugin_name);
CREATE INDEX IF NOT EXISTS idx_plugin_crashes_created_at ON plugin_crashes(created_at DESC);
