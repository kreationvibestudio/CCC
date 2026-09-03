-- Attach photos/videos to field agent reports (corroborating evidence).

CREATE TABLE IF NOT EXISTS agent_report_media (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id UUID NOT NULL REFERENCES agent_reports(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL CHECK (media_type IN ('photo', 'video')),
  url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_report_media_report ON agent_report_media(report_id);

ALTER TABLE agent_report_media ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agent_report_media_tenant ON agent_report_media;
CREATE POLICY agent_report_media_tenant ON agent_report_media
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM agent_reports r
      WHERE r.id = report_id AND r.tenant_id = public.current_tenant_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM agent_reports r
      WHERE r.id = report_id AND r.tenant_id = public.current_tenant_id()
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.agent_report_media TO authenticated, service_role;
