-- Operational RLS: tables that had RLS enabled with no policies (deny-all),
-- plus INSERT on activities, and RLS on check-in / attendance / media tables.
-- Idempotent.

-- Tenant-scoped tables
DROP POLICY IF EXISTS tenant_isolation_volunteer_tasks ON volunteer_tasks;
CREATE POLICY tenant_isolation_volunteer_tasks ON volunteer_tasks
  FOR ALL USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_agent_reports ON agent_reports;
CREATE POLICY tenant_isolation_agent_reports ON agent_reports
  FOR ALL USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_messages ON messages;
CREATE POLICY tenant_isolation_messages ON messages
  FOR ALL USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_ai_analyses ON ai_analyses;
CREATE POLICY tenant_isolation_ai_analyses ON ai_analyses
  FOR ALL USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_ai_suggestions ON ai_suggestions;
CREATE POLICY tenant_isolation_ai_suggestions ON ai_suggestions
  FOR ALL USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_ai_briefings ON ai_briefings;
CREATE POLICY tenant_isolation_ai_briefings ON ai_briefings
  FOR ALL USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_activities ON activities;
CREATE POLICY tenant_isolation_activities ON activities
  FOR ALL USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

-- Child tables (no tenant_id) — via parent
DROP POLICY IF EXISTS comment_notes_access ON comment_notes;
CREATE POLICY comment_notes_access ON comment_notes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM comments c
      WHERE c.id = comment_id AND c.tenant_id = public.current_tenant_id()
    )
  );

DROP POLICY IF EXISTS contact_interactions_access ON contact_interactions;
CREATE POLICY contact_interactions_access ON contact_interactions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM contacts ct
      WHERE ct.id = contact_id AND ct.tenant_id = public.current_tenant_id()
    )
  );

DROP POLICY IF EXISTS event_attendees_tenant ON event_attendees;
CREATE POLICY event_attendees_tenant ON event_attendees
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM campaign_events e
      WHERE e.id = event_id AND e.tenant_id = public.current_tenant_id()
    )
  );

ALTER TABLE event_checkins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS event_checkins_tenant ON event_checkins;
CREATE POLICY event_checkins_tenant ON event_checkins
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM campaign_events e
      WHERE e.id = event_id AND e.tenant_id = public.current_tenant_id()
    )
  );

ALTER TABLE volunteer_attendance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS volunteer_attendance_access ON volunteer_attendance;
CREATE POLICY volunteer_attendance_access ON volunteer_attendance
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM volunteers v
      WHERE v.id = volunteer_id AND v.tenant_id = public.current_tenant_id()
    )
  );

ALTER TABLE volunteer_checkins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS volunteer_checkins_access ON volunteer_checkins;
CREATE POLICY volunteer_checkins_access ON volunteer_checkins
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM volunteers v
      WHERE v.id = volunteer_id AND v.tenant_id = public.current_tenant_id()
    )
  );

ALTER TABLE event_photos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS event_photos_tenant ON event_photos;
CREATE POLICY event_photos_tenant ON event_photos
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM campaign_events e
      WHERE e.id = event_id AND e.tenant_id = public.current_tenant_id()
    )
  );

ALTER TABLE incident_media ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS incident_media_tenant ON incident_media;
CREATE POLICY incident_media_tenant ON incident_media
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM incident_reports r
      WHERE r.id = incident_id AND r.tenant_id = public.current_tenant_id()
    )
  );

ALTER TABLE tenant_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_settings_tenant ON tenant_settings;
CREATE POLICY tenant_settings_tenant ON tenant_settings
  FOR ALL USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());
