-- Fast reset: TRUNCATE operational tables. Do not rewrite every polling unit
-- (that timed out at ~176k rows). Safe to re-run.

CREATE OR REPLACE FUNCTION public.zero_operational_campaign_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '120s'
AS $$
DECLARE
  pu_count bigint;
  tables text[] := ARRAY[
    'comment_notes',
    'comment_responses',
    'comments',
    'social_posts',
    'social_accounts',
    'ai_analyses',
    'ai_briefings',
    'ai_suggestions',
    'volunteer_tasks',
    'volunteer_attendance',
    'volunteer_checkins',
    'volunteers',
    'contact_interactions',
    'donations',
    'contacts',
    'event_photos',
    'event_checkins',
    'event_attendees',
    'campaign_events',
    'incident_media',
    'incident_reports',
    'election_results',
    'agent_reports',
    'polling_unit_status',
    'messages',
    'message_campaigns',
    'message_templates',
    'notifications',
    'activities',
    'audit_logs',
    'tenant_settings',
    'campaign_locations'
  ];
  present text[] := '{}';
  t text;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      present := present || t;
    END IF;
  END LOOP;

  IF coalesce(array_length(present, 1), 0) > 0 THEN
    EXECUTE 'TRUNCATE TABLE ' || array_to_string(
      ARRAY(SELECT quote_ident(x) FROM unnest(present) AS x),
      ', '
    ) || ' RESTART IDENTITY CASCADE';
  END IF;

  UPDATE tenants
  SET
    name = 'Campaign',
    slug = 'campaign',
    logo_url = NULL,
    election_date = NULL,
    campaign_end_date = NULL,
    fundraising_goal = 0
  WHERE id = 'a0000000-0000-0000-0000-000000000001';

  SELECT count(*) INTO pu_count FROM polling_units;

  RETURN jsonb_build_object('ok', true, 'polling_units', pu_count);
END;
$$;

REVOKE ALL ON FUNCTION public.zero_operational_campaign_data() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.zero_operational_campaign_data() TO service_role;

NOTIFY pgrst, 'reload schema';
