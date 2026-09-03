-- Reset only Situation Room live data (results, incidents, statuses, agent reports).
-- Leaves polling units, users, CRM, volunteers, settings, etc. untouched.

CREATE OR REPLACE FUNCTION public.zero_situation_room_data(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '60s'
AS $$
DECLARE
  n_incidents bigint := 0;
  n_results bigint := 0;
  n_reports bigint := 0;
  n_statuses bigint := 0;
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id is required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = p_tenant_id) THEN
    RAISE EXCEPTION 'Unknown workspace';
  END IF;

  SELECT count(*) INTO n_incidents FROM public.incident_reports WHERE tenant_id = p_tenant_id;
  SELECT count(*) INTO n_results FROM public.election_results WHERE tenant_id = p_tenant_id;
  SELECT count(*) INTO n_reports FROM public.agent_reports WHERE tenant_id = p_tenant_id;
  SELECT count(*) INTO n_statuses FROM public.polling_unit_status WHERE tenant_id = p_tenant_id;

  DELETE FROM public.incident_media
    WHERE incident_id IN (SELECT id FROM public.incident_reports WHERE tenant_id = p_tenant_id);

  DELETE FROM public.incident_reports WHERE tenant_id = p_tenant_id;
  DELETE FROM public.election_results WHERE tenant_id = p_tenant_id;
  -- agent_report_media cascades from agent_reports
  DELETE FROM public.agent_reports WHERE tenant_id = p_tenant_id;
  DELETE FROM public.polling_unit_status WHERE tenant_id = p_tenant_id;

  RETURN jsonb_build_object(
    'ok', true,
    'tenant_id', p_tenant_id,
    'incident_reports', n_incidents,
    'election_results', n_results,
    'agent_reports', n_reports,
    'polling_unit_status', n_statuses
  );
END;
$$;

REVOKE ALL ON FUNCTION public.zero_situation_room_data(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.zero_situation_room_data(uuid) TO service_role;
