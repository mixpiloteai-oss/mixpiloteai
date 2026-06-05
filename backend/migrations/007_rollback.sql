DROP TABLE IF EXISTS public.sync_dedup CASCADE;
DROP TABLE IF EXISTS public.collab_presence CASCADE;
DROP TABLE IF EXISTS public.collab_snapshots CASCADE;
DROP TABLE IF EXISTS public.collab_ops CASCADE;
ALTER TABLE public.collab_rooms DROP COLUMN IF EXISTS snapshot_rev;
ALTER TABLE public.collab_rooms DROP COLUMN IF EXISTS max_rev;
