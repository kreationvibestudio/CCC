-- Fast LGA/ward lists and summaries so HQ pages do not scan ~176k polling units.
-- Also add INSERT WITH CHECK on CRM tables (USING-only policies reject inserts on some setups).

CREATE OR REPLACE FUNCTION public.distinct_polling_lgas()
RETURNS TABLE (lga text)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT DISTINCT u.lga
  FROM polling_units u
  WHERE u.tenant_id = public.current_tenant_id()
    AND u.lga IS NOT NULL
    AND btrim(u.lga) <> ''
  ORDER BY 1;
$$;

CREATE OR REPLACE FUNCTION public.distinct_polling_wards(p_lga text)
RETURNS TABLE (ward text)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT DISTINCT u.ward
  FROM polling_units u
  WHERE u.tenant_id = public.current_tenant_id()
    AND (p_lga IS NULL OR p_lga = '' OR u.lga = p_lga)
    AND u.ward IS NOT NULL
    AND btrim(u.ward) <> ''
  ORDER BY 1;
$$;

CREATE OR REPLACE FUNCTION public.polling_units_summary(p_lga text DEFAULT NULL, p_ward text DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'pu_count', count(*),
    'registered_voters', coalesce(sum(registered_voters), 0),
    'mapped', count(*) FILTER (WHERE latitude IS NOT NULL AND longitude IS NOT NULL)
  )
  FROM polling_units u
  WHERE u.tenant_id = public.current_tenant_id()
    AND (p_lga IS NULL OR p_lga = '' OR u.lga = p_lga)
    AND (p_ward IS NULL OR p_ward = '' OR u.ward = p_ward);
$$;

CREATE OR REPLACE FUNCTION public.top_polling_wards(p_limit integer DEFAULT 8)
RETURNS TABLE (ward text, voters bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT u.ward, coalesce(sum(u.registered_voters), 0)::bigint AS voters
  FROM polling_units u
  WHERE u.tenant_id = public.current_tenant_id()
    AND u.ward IS NOT NULL
    AND btrim(u.ward) <> ''
  GROUP BY u.ward
  ORDER BY voters DESC
  LIMIT GREATEST(1, LEAST(p_limit, 25));
$$;

REVOKE ALL ON FUNCTION public.distinct_polling_lgas() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.distinct_polling_wards(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.polling_units_summary(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.top_polling_wards(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.distinct_polling_lgas() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.distinct_polling_wards(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.polling_units_summary(text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.top_polling_wards(integer) TO authenticated, service_role;

DROP POLICY IF EXISTS tenant_isolation_contacts ON contacts;
CREATE POLICY tenant_isolation_contacts ON contacts
  FOR ALL USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_donations ON donations;
CREATE POLICY tenant_isolation_donations ON donations
  FOR ALL USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS contact_interactions_access ON contact_interactions;
CREATE POLICY contact_interactions_access ON contact_interactions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM contacts ct
      WHERE ct.id = contact_id AND ct.tenant_id = public.current_tenant_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM contacts ct
      WHERE ct.id = contact_id AND ct.tenant_id = public.current_tenant_id()
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.contacts TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.donations TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.contact_interactions TO authenticated, service_role;
