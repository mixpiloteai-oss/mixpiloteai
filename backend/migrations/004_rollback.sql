-- ============================================================
-- ROLLBACK for Migration 004
-- Drops all tables added in 004_complete_schema.sql.
-- Run ONLY to revert to the 003 schema state.
-- WARNING: this destroys all data in these tables.
-- ============================================================

-- Drop in reverse FK dependency order
DROP TABLE IF EXISTS public.ticket_messages        CASCADE;
DROP TABLE IF EXISTS public.support_tickets        CASCADE;
DROP TABLE IF EXISTS public.billing_history        CASCADE;
DROP TABLE IF EXISTS public.collab_rooms           CASCADE;
DROP TABLE IF EXISTS public.project_versions       CASCADE;
DROP TABLE IF EXISTS public.coupon_redemptions     CASCADE;
DROP TABLE IF EXISTS public.coupons                CASCADE;
DROP TABLE IF EXISTS public.project_permissions    CASCADE;
DROP TABLE IF EXISTS public.team_invitations       CASCADE;
DROP TABLE IF EXISTS public.team_members           CASCADE;
DROP TABLE IF EXISTS public.teams                  CASCADE;
DROP TABLE IF EXISTS public.marketplace_comments   CASCADE;
DROP TABLE IF EXISTS public.marketplace_likes      CASCADE;
DROP TABLE IF EXISTS public.marketplace_products   CASCADE;
DROP TABLE IF EXISTS public.pack_comments          CASCADE;
DROP TABLE IF EXISTS public.packs                  CASCADE;
DROP TABLE IF EXISTS public.templates              CASCADE;

DROP FUNCTION IF EXISTS public.refresh_trending_scores();
