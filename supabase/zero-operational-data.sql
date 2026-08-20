-- Wipe all campaign sample/operational data. Keep polling units + geography + tenant.
-- Safe to re-run. Run in Supabase SQL Editor as postgres (Dashboard → SQL).

DO $$
DECLARE
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
    EXECUTE 'TRUNCATE TABLE ' || array_to_string(present, ', ') || ' RESTART IDENTITY CASCADE';
  END IF;
END $$;

UPDATE tenants
SET
  name = 'Campaign',
  slug = 'campaign',
  logo_url = NULL,
  election_date = NULL,
  campaign_end_date = NULL,
  fundraising_goal = 0
WHERE id = 'a0000000-0000-0000-0000-000000000001';

UPDATE polling_units
SET
  assigned_agent_id = NULL,
  assigned_supervisor_id = NULL,
  security_notes = NULL,
  logistics = NULL,
  contact_phone = NULL,
  historical_results = '[]'::jsonb,
  risk_level = 'low';
