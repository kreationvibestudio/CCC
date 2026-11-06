-- Unit members: NDC party members registered to an LGA / ward / polling unit.
-- Multiple members may belong to the same unit (unlike field agents).

CREATE TABLE IF NOT EXISTS unit_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  polling_unit_id UUID REFERENCES polling_units(id) ON DELETE SET NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  voters_card_number TEXT NOT NULL,
  membership_card_number TEXT NOT NULL,
  state TEXT,
  lga TEXT NOT NULL,
  ward TEXT NOT NULL,
  unit_code TEXT,
  unit_name TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, phone),
  UNIQUE (tenant_id, voters_card_number),
  UNIQUE (tenant_id, membership_card_number)
);

CREATE INDEX IF NOT EXISTS unit_members_tenant_id_idx ON unit_members (tenant_id);
CREATE INDEX IF NOT EXISTS unit_members_lga_ward_idx ON unit_members (tenant_id, lga, ward);
CREATE INDEX IF NOT EXISTS unit_members_polling_unit_id_idx ON unit_members (polling_unit_id);
CREATE INDEX IF NOT EXISTS unit_members_name_idx ON unit_members (tenant_id, last_name, first_name);

ALTER TABLE unit_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_unit_members ON unit_members;
CREATE POLICY tenant_isolation_unit_members ON unit_members
  FOR ALL USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.unit_members TO authenticated, service_role;

COMMENT ON TABLE unit_members IS 'NDC unit members registered for a campaign workspace (LGA / ward / polling unit).';
COMMENT ON COLUMN unit_members.membership_card_number IS 'NDC party card membership number';
COMMENT ON COLUMN unit_members.voters_card_number IS 'INEC voter card (PVC) number';

-- Keep campaign_party = NDC for the seed workspace when unset.
INSERT INTO tenant_settings (tenant_id, key, value)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'campaign_party',
  '{"party":"NDC"}'::jsonb
)
ON CONFLICT (tenant_id, key) DO NOTHING;

-- Include unit_members in tenant wipe / zero-ops.
CREATE OR REPLACE FUNCTION public.zero_operational_campaign_data(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '300s'
AS $$
DECLARE
  pu_count bigint;
  child_deletes text[][] := ARRAY[
    ARRAY['comment_notes', 'comment_id', 'comments'],
    ARRAY['comment_responses', 'comment_id', 'comments'],
    ARRAY['volunteer_attendance', 'volunteer_id', 'volunteers'],
    ARRAY['volunteer_checkins', 'volunteer_id', 'volunteers'],
    ARRAY['event_photos', 'event_id', 'campaign_events'],
    ARRAY['event_checkins', 'event_id', 'campaign_events'],
    ARRAY['event_attendees', 'event_id', 'campaign_events'],
    ARRAY['incident_media', 'incident_id', 'incident_reports'],
    ARRAY['contact_interactions', 'contact_id', 'contacts'],
    ARRAY['agent_report_media', 'report_id', 'agent_reports']
  ];
  scoped_tables text[] := ARRAY[
    'comments',
    'social_posts',
    'social_accounts',
    'ai_analyses',
    'ai_briefings',
    'ai_suggestions',
    'volunteer_tasks',
    'volunteers',
    'donations',
    'contacts',
    'campaign_events',
    'incident_reports',
    'election_results',
    'agent_reports',
    'agent_checkins',
    'agent_access_codes',
    'agent_device_tokens',
    'agents',
    'unit_members',
    'media_content',
    'lms_activity_logs',
    'lms_session_attendees',
    'lms_certificates',
    'lms_quiz_attempts',
    'lms_module_progress',
    'lms_enrollments',
    'lms_live_sessions',
    'lms_modules',
    'lms_courses',
    'polling_unit_status',
    'messages',
    'message_campaigns',
    'message_templates',
    'notifications',
    'activities',
    'audit_logs',
    'campaign_locations'
  ];
  child text[];
  t text;
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id is required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = p_tenant_id) THEN
    RAISE EXCEPTION 'Unknown workspace';
  END IF;

  FOREACH child SLICE 1 IN ARRAY child_deletes LOOP
    IF to_regclass('public.' || child[1]) IS NOT NULL
       AND to_regclass('public.' || child[3]) IS NOT NULL THEN
      EXECUTE format(
        'DELETE FROM public.%I WHERE %I IN (SELECT id FROM public.%I WHERE tenant_id = $1)',
        child[1], child[2], child[3]
      ) USING p_tenant_id;
    END IF;
  END LOOP;

  FOREACH t IN ARRAY scoped_tables LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('DELETE FROM public.%I WHERE tenant_id = $1', t) USING p_tenant_id;
    END IF;
  END LOOP;

  IF to_regclass('public.tenant_settings') IS NOT NULL THEN
    DELETE FROM public.tenant_settings
    WHERE tenant_id = p_tenant_id
      AND key NOT IN (
        'campaign_party',
        'campaign_start_date',
        'paystack_payment_link',
        'facebook_page_id',
        'facebook_page_access_token',
        'facebook_user_access_token'
      );
  END IF;

  IF to_regclass('public.tenant_invites') IS NOT NULL THEN
    DELETE FROM public.tenant_invites WHERE tenant_id = p_tenant_id AND used_at IS NULL;
  END IF;

  UPDATE public.polling_units
  SET assigned_agent_id = NULL, assigned_supervisor_id = NULL
  WHERE tenant_id = p_tenant_id;

  SELECT count(*) INTO pu_count FROM public.polling_units WHERE tenant_id = p_tenant_id;

  RETURN jsonb_build_object('ok', true, 'tenant_id', p_tenant_id, 'polling_units', pu_count);
END;
$$;

REVOKE ALL ON FUNCTION public.zero_operational_campaign_data(uuid) FROM PUBLIC;
DO $$
BEGIN
  BEGIN
    REVOKE ALL ON FUNCTION public.zero_operational_campaign_data(uuid) FROM anon, authenticated;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END $$;
GRANT EXECUTE ON FUNCTION public.zero_operational_campaign_data(uuid) TO service_role;
