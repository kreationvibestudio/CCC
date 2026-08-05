-- Local development privilege grants for Campaign Command Center.
--
-- The application schema (supabase/migrations) defines Row Level Security
-- policies but relies on the base table/sequence GRANTs that Supabase Cloud
-- provisions implicitly for the `anon`, `authenticated`, and `service_role`
-- roles. A fresh local `supabase db reset` does NOT create those grants, so
-- every authenticated query fails with "permission denied for table ...",
-- which makes `getCurrentUser()` return null and traps the app in a
-- /login <-> /dashboard redirect loop.
--
-- These statements reproduce Supabase's default grants locally. RLS still
-- enforces per-tenant row visibility on top of them, so granting table access
-- to these roles does not weaken tenant isolation. The script is idempotent.

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
