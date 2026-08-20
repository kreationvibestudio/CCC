-- Agent field reports were RLS-enabled with no INSERT policy in the original schema.
-- Explicit policies + realtime + universe stats for Situation Room race analysis.

GRANT EXECUTE ON FUNCTION public.current_tenant_id() TO authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.agent_reports TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.polling_unit_status TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.incident_reports TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.election_results TO authenticated, service_role;

DROP POLICY IF EXISTS tenant_isolation_agent_reports ON agent_reports;
DROP POLICY IF EXISTS agent_reports_select ON agent_reports;
DROP POLICY IF EXISTS agent_reports_insert ON agent_reports;
DROP POLICY IF EXISTS agent_reports_update ON agent_reports;
DROP POLICY IF EXISTS agent_reports_delete ON agent_reports;

CREATE POLICY agent_reports_select ON agent_reports
  FOR SELECT USING (tenant_id = public.current_tenant_id());

CREATE POLICY agent_reports_insert ON agent_reports
  FOR INSERT WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND (agent_id IS NULL OR agent_id = auth.uid())
  );

CREATE POLICY agent_reports_update ON agent_reports
  FOR UPDATE
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY agent_reports_delete ON agent_reports
  FOR DELETE USING (tenant_id = public.current_tenant_id());

-- WITH CHECK on other election write paths (USING-only policies can reject INSERT on some PG/Supabase setups)
DROP POLICY IF EXISTS tenant_isolation_pu_status ON polling_unit_status;
CREATE POLICY tenant_isolation_pu_status ON polling_unit_status
  FOR ALL USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_incidents ON incident_reports;
CREATE POLICY tenant_isolation_incidents ON incident_reports
  FOR ALL USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_results ON election_results;
CREATE POLICY tenant_isolation_results ON election_results
  FOR ALL USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE agent_reports;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.election_universe_stats()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'pu_count', count(*),
    'registered_voters', coalesce(sum(registered_voters), 0)
  )
  FROM polling_units
  WHERE tenant_id = public.current_tenant_id();
$$;

REVOKE ALL ON FUNCTION public.election_universe_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.election_universe_stats() TO authenticated, service_role;
