-- Content calendar for Media Command. Staff-only; tenant isolated.

DO $$ BEGIN
  CREATE TYPE media_content_status AS ENUM ('draft', 'approved', 'scheduled', 'posted', 'killed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS media_content (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  issue_topic issue_topic,
  platform social_platform NOT NULL DEFAULT 'facebook',
  status media_content_status NOT NULL DEFAULT 'draft',
  scheduled_at TIMESTAMPTZ,
  posted_at TIMESTAMPTZ,
  social_post_id UUID REFERENCES social_posts(id) ON DELETE SET NULL,
  talking_points TEXT[] NOT NULL DEFAULT '{}',
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_content_tenant_status
  ON media_content (tenant_id, status, scheduled_at);

ALTER TABLE media_content ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_media_content ON media_content;
CREATE POLICY tenant_isolation_media_content ON media_content
  FOR ALL USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.media_content TO authenticated, service_role;
