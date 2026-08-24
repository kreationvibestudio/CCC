-- Bulk-remove non-Edo polling units without tripping PostgREST URL limits.

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
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant required';
  END IF;
  IF public.current_tenant_id() IS NOT NULL AND public.current_tenant_id() <> p_tenant_id THEN
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
GRANT EXECUTE ON FUNCTION public.prune_non_campaign_polling_units(uuid, integer) TO authenticated, service_role;
