-- Tenant safety for the privileged maintenance functions, plus a few grants and
-- constraints that were wrong. Safe to re-run.

-- ---------------------------------------------------------------------------
-- 1. zero_operational_campaign_data
--
-- 20260820000001 shipped a no-argument version that TRUNCATEd every
-- operational table for every workspace, then rewrote the seed tenant's name.
-- 20260821000000 replaced it with a tenant-scoped DELETE, but a database that
-- only ever applied the earlier file still carries the cross-tenant wipe, and
-- both callers now pass p_tenant_id so the RPC would fail there anyway.
--
-- Re-assert the tenant-scoped form here so the outcome is the same regardless
-- of which migrations a given instance has seen. Body matches 20260821000000
-- (settings keys for live integrations survive; agent assignments are cleared)
-- with to_regclass guards so a partial schema cannot abort the wipe.
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.zero_operational_campaign_data();

CREATE OR REPLACE FUNCTION public.zero_operational_campaign_data(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '300s'
AS $$
DECLARE
  pu_count bigint;
  -- Children reached through a parent that carries the tenant_id.
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
  -- Tables with their own tenant_id, ordered so referenced rows go last.
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

  -- Keep the keys that hold live integration credentials; losing these would
  -- silently disconnect Facebook and Paystack for the workspace.
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

-- ---------------------------------------------------------------------------
-- 2. prune_non_campaign_polling_units
--
-- The tenant check was skipped whenever current_tenant_id() returned NULL,
-- which is exactly the case for an authenticated user with no profile row.
-- That plus EXECUTE for `authenticated` let any signed-in account delete
-- another workspace's polling units. Now service-role only, and the caller's
-- tenant must match when a tenant context exists.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.prune_non_campaign_polling_units(
  p_tenant_id uuid,
  p_limit integer DEFAULT 2000
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  doomed uuid[];
  n integer := 0;
  cap integer;
  caller_tenant uuid;
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant required';
  END IF;

  caller_tenant := public.current_tenant_id();
  IF caller_tenant IS NOT NULL AND caller_tenant <> p_tenant_id THEN
    RAISE EXCEPTION 'tenant mismatch';
  END IF;

  cap := GREATEST(1, LEAST(coalesce(p_limit, 2000), 5000));

  SELECT coalesce(array_agg(id), '{}') INTO doomed
  FROM (
    SELECT u.id
    FROM polling_units u
    WHERE u.tenant_id = p_tenant_id
      AND NOT public.campaign_polling_unit(u)
    LIMIT cap
  ) s;

  n := coalesce(cardinality(doomed), 0);
  IF n = 0 THEN
    RETURN jsonb_build_object('pruned', 0, 'remaining', 0);
  END IF;

  DELETE FROM election_results WHERE polling_unit_id = ANY (doomed);
  UPDATE incident_reports SET polling_unit_id = NULL WHERE polling_unit_id = ANY (doomed);
  UPDATE agent_reports SET polling_unit_id = NULL WHERE polling_unit_id = ANY (doomed);
  DELETE FROM polling_units WHERE tenant_id = p_tenant_id AND id = ANY (doomed);

  RETURN jsonb_build_object('pruned', n, 'remaining', CASE WHEN n >= cap THEN 1 ELSE 0 END);
END;
$$;

REVOKE ALL ON FUNCTION public.prune_non_campaign_polling_units(uuid, integer) FROM PUBLIC;
DO $$
BEGIN
  BEGIN
    REVOKE ALL ON FUNCTION public.prune_non_campaign_polling_units(uuid, integer) FROM anon, authenticated;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END $$;
GRANT EXECUTE ON FUNCTION public.prune_non_campaign_polling_units(uuid, integer) TO service_role;

-- 3. purge_non_edo_sample_data: same treatment, service role only.
DO $$
BEGIN
  BEGIN
    REVOKE ALL ON FUNCTION public.purge_non_edo_sample_data(uuid) FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.purge_non_edo_sample_data(uuid) TO service_role;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END $$;

-- 4. agent_device_tokens: the policy checked the user but not the workspace, so
-- a token row could be filed under any tenant_id.
DO $$
BEGIN
  IF to_regclass('public.agent_device_tokens') IS NULL THEN
    RETURN;
  END IF;

  DROP POLICY IF EXISTS agent_device_tokens_self ON public.agent_device_tokens;

  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'current_tenant_id'
  ) THEN
    EXECUTE $p$CREATE POLICY agent_device_tokens_self ON public.agent_device_tokens
      FOR ALL
      USING (user_id = auth.uid() AND tenant_id = public.current_tenant_id())
      WITH CHECK (user_id = auth.uid() AND tenant_id = public.current_tenant_id())$p$;
  ELSE
    EXECUTE $p$CREATE POLICY agent_device_tokens_self ON public.agent_device_tokens
      FOR ALL
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid())$p$;
  END IF;
END $$;

-- 5. donations.contact_id had no ON DELETE action, so deleting a contact failed
-- once they had a donation. Keep the donation, drop the link.
DO $$
DECLARE
  fk_name text;
  fk_action "char";
BEGIN
  IF to_regclass('public.donations') IS NULL OR to_regclass('public.contacts') IS NULL THEN
    RETURN;
  END IF;

  SELECT con.conname, con.confdeltype INTO fk_name, fk_action
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'public'
    AND rel.relname = 'donations'
    AND con.contype = 'f'
    AND con.confrelid = 'public.contacts'::regclass
  LIMIT 1;

  -- confdeltype 'n' is SET NULL; anything else (default 'a', NO ACTION) blocks
  -- the delete. Only rewrite when needed so this stays idempotent.
  IF fk_name IS NOT NULL AND fk_action <> 'n' THEN
    EXECUTE format('ALTER TABLE public.donations DROP CONSTRAINT %I', fk_name);
    ALTER TABLE public.donations
      ADD CONSTRAINT donations_contact_id_fkey
      FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 6. election-media must stay private: signed URLs are the only read path.
-- scripts/cloud-setup.mjs used to create it public when absent.
DO $$
BEGIN
  UPDATE storage.buckets SET public = false WHERE id = 'election-media';
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

NOTIFY pgrst, 'reload schema';
