-- Harden per-workspace isolation for field agents + include agent tables in
-- workspace operational reset. Features (agents, NIN columns, RLS) are shared
-- schema for every tenant; data rows stay siloed by tenant_id.

-- ---------------------------------------------------------------------------
-- 1. Reject agents rows that point at another workspace's PU or profile
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.agents_enforce_same_tenant()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  pu_tenant uuid;
  profile_tenant uuid;
BEGIN
  IF NEW.polling_unit_id IS NOT NULL THEN
    SELECT tenant_id INTO pu_tenant
    FROM public.polling_units
    WHERE id = NEW.polling_unit_id;
    IF pu_tenant IS NULL THEN
      RAISE EXCEPTION 'agents.polling_unit_id does not exist';
    END IF;
    IF pu_tenant <> NEW.tenant_id THEN
      RAISE EXCEPTION 'agents.polling_unit_id belongs to another workspace';
    END IF;
  END IF;

  IF NEW.profile_id IS NOT NULL THEN
    SELECT tenant_id INTO profile_tenant
    FROM public.profiles
    WHERE id = NEW.profile_id;
    IF profile_tenant IS NULL THEN
      RAISE EXCEPTION 'agents.profile_id does not exist';
    END IF;
    IF profile_tenant <> NEW.tenant_id THEN
      RAISE EXCEPTION 'agents.profile_id belongs to another workspace';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS agents_enforce_same_tenant ON public.agents;
CREATE TRIGGER agents_enforce_same_tenant
  BEFORE INSERT OR UPDATE OF tenant_id, polling_unit_id, profile_id
  ON public.agents
  FOR EACH ROW
  EXECUTE FUNCTION public.agents_enforce_same_tenant();

-- ---------------------------------------------------------------------------
-- 2. Workspace reset must clear agent registration / codes / check-ins too
--    (only for p_tenant_id — never cross-tenant)
-- ---------------------------------------------------------------------------

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
    'media_content',
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

NOTIFY pgrst, 'reload schema';
