-- Multi-profile Facebook Watch feed (paste share/post links; no timeline scrape).

CREATE TABLE IF NOT EXISTS public.social_watch_targets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  facebook_username TEXT NOT NULL,
  profile_url TEXT,
  notes TEXT,
  archived_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS social_watch_targets_tenant_username_uidx
  ON public.social_watch_targets (tenant_id, lower(facebook_username));

CREATE INDEX IF NOT EXISTS social_watch_targets_tenant_active_idx
  ON public.social_watch_targets (tenant_id, archived_at NULLS FIRST, display_name);

CREATE TABLE IF NOT EXISTS public.social_watch_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  target_id UUID REFERENCES public.social_watch_targets(id) ON DELETE SET NULL,
  source_url TEXT NOT NULL,
  canonical_url TEXT NOT NULL,
  author_name TEXT,
  title TEXT,
  body TEXT,
  keyword_hits TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'reviewed', 'flagged')),
  captured_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'social_watch_posts_tenant_canonical_key'
  ) THEN
    ALTER TABLE public.social_watch_posts
      ADD CONSTRAINT social_watch_posts_tenant_canonical_key UNIQUE (tenant_id, canonical_url);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS social_watch_posts_tenant_time_idx
  ON public.social_watch_posts (tenant_id, captured_at DESC);

CREATE INDEX IF NOT EXISTS social_watch_posts_target_idx
  ON public.social_watch_posts (tenant_id, target_id, captured_at DESC);

ALTER TABLE public.social_watch_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_watch_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_social_watch_targets ON public.social_watch_targets;
CREATE POLICY tenant_isolation_social_watch_targets ON public.social_watch_targets
  FOR ALL USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_social_watch_posts ON public.social_watch_posts;
CREATE POLICY tenant_isolation_social_watch_posts ON public.social_watch_posts
  FOR ALL USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.social_watch_targets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.social_watch_posts TO authenticated;
GRANT ALL ON TABLE public.social_watch_targets TO service_role;
GRANT ALL ON TABLE public.social_watch_posts TO service_role;

COMMENT ON TABLE public.social_watch_targets IS
  'Facebook handles HQ wants to monitor. Capture is paste-link only — no personal timeline scrape.';
COMMENT ON TABLE public.social_watch_posts IS
  'Posts captured from public Facebook share/post Open Graph metadata.';

NOTIFY pgrst, 'reload schema';
