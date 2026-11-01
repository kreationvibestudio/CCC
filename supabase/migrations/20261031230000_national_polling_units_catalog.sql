-- Shared Nigeria polling-unit catalog (read by every tenant).
-- Tenant-local polling_units remain for assignment / Situation Room wiring;
-- registration materializes a local row from this catalog by official code.

CREATE TABLE IF NOT EXISTS public.national_polling_units (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL UNIQUE,
  pu_code TEXT,
  name TEXT NOT NULL,
  ward TEXT NOT NULL,
  lga TEXT NOT NULL,
  state TEXT NOT NULL,
  state_code TEXT,
  lg_code TEXT,
  ward_code TEXT,
  registered_voters INTEGER DEFAULT 0,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  address TEXT,
  geocode_status TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS national_polling_units_state_idx
  ON public.national_polling_units (state);
CREATE INDEX IF NOT EXISTS national_polling_units_state_lga_ward_idx
  ON public.national_polling_units (state, lga, ward);
CREATE INDEX IF NOT EXISTS national_polling_units_state_code_idx
  ON public.national_polling_units (state_code);

ALTER TABLE public.national_polling_units ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS national_polling_units_select ON public.national_polling_units;
CREATE POLICY national_polling_units_select ON public.national_polling_units
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS national_polling_units_service ON public.national_polling_units;
CREATE POLICY national_polling_units_service ON public.national_polling_units
  FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT SELECT ON public.national_polling_units TO authenticated;
GRANT ALL ON public.national_polling_units TO service_role;

-- Backfill from existing tenant-local Edo (and any other) rows, prefer densest codes.
INSERT INTO public.national_polling_units (
  code, pu_code, name, ward, lga, state, state_code, lg_code, ward_code,
  registered_voters, latitude, longitude, address, geocode_status
)
SELECT DISTINCT ON (upper(trim(u.code)))
  trim(u.code),
  u.pu_code,
  u.name,
  u.ward,
  u.lga,
  u.state,
  u.state_code,
  u.lg_code,
  u.ward_code,
  COALESCE(u.registered_voters, 0),
  u.latitude,
  u.longitude,
  u.address,
  u.geocode_status
FROM public.polling_units u
WHERE u.code IS NOT NULL AND trim(u.code) <> ''
ORDER BY upper(trim(u.code)), (u.latitude IS NOT NULL AND u.longitude IS NOT NULL) DESC, u.created_at ASC
ON CONFLICT (code) DO NOTHING;

-- Geography helpers no longer hard-gate on Edo. Predicate stays for RPC compat
-- but always returns true so national rows / any state are eligible.
CREATE OR REPLACE FUNCTION public.campaign_polling_unit(u public.polling_units)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT u.code IS NOT NULL AND length(trim(u.code)) > 0;
$$;

REVOKE ALL ON FUNCTION public.campaign_polling_unit(polling_units) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.campaign_polling_unit(polling_units) TO authenticated, service_role;

-- Distinct states / wards / PUs from the national catalog (cascade narrowing).
CREATE OR REPLACE FUNCTION public.national_pu_states()
RETURNS TABLE (state text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT n.state
  FROM public.national_polling_units n
  WHERE n.state IS NOT NULL AND trim(n.state) <> ''
  ORDER BY 1;
$$;

CREATE OR REPLACE FUNCTION public.national_pu_wards(p_state text)
RETURNS TABLE (ward text, lga text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT n.ward, n.lga
  FROM public.national_polling_units n
  WHERE p_state IS NOT NULL
    AND trim(p_state) <> ''
    AND (
      n.state = trim(p_state)
      OR n.state ILIKE trim(p_state) || '%'
      OR upper(n.state) = upper(trim(p_state))
    )
    AND n.ward IS NOT NULL AND n.lga IS NOT NULL
  ORDER BY 2, 1;
$$;

CREATE OR REPLACE FUNCTION public.national_pu_units(p_state text, p_lga text, p_ward text)
RETURNS SETOF public.national_polling_units
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT n.*
  FROM public.national_polling_units n
  WHERE p_state IS NOT NULL AND trim(p_state) <> ''
    AND p_lga IS NOT NULL AND trim(p_lga) <> ''
    AND p_ward IS NOT NULL AND trim(p_ward) <> ''
    AND (
      n.state = trim(p_state)
      OR n.state ILIKE trim(p_state) || '%'
      OR upper(n.state) = upper(trim(p_state))
    )
    AND n.lga = trim(p_lga)
    AND n.ward = trim(p_ward)
  ORDER BY n.code;
$$;

REVOKE ALL ON FUNCTION public.national_pu_states() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.national_pu_wards(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.national_pu_units(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.national_pu_states() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.national_pu_wards(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.national_pu_units(text, text, text) TO authenticated, service_role;

-- Materialize a national PU into a tenant-local row (for agents FK + assigned_agent_id).
CREATE OR REPLACE FUNCTION public.ensure_tenant_polling_unit(p_tenant_id uuid, p_national_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n public.national_polling_units%ROWTYPE;
  existing uuid;
  created uuid;
BEGIN
  IF p_tenant_id IS NULL OR p_national_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id and national_id are required';
  END IF;

  SELECT * INTO n FROM public.national_polling_units WHERE id = p_national_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'National polling unit not found';
  END IF;

  SELECT u.id INTO existing
  FROM public.polling_units u
  WHERE u.tenant_id = p_tenant_id AND upper(trim(u.code)) = upper(trim(n.code))
  LIMIT 1;

  IF existing IS NOT NULL THEN
    UPDATE public.polling_units u SET
      name = n.name,
      ward = n.ward,
      lga = n.lga,
      state = n.state,
      pu_code = COALESCE(n.pu_code, u.pu_code),
      state_code = COALESCE(n.state_code, u.state_code),
      lg_code = COALESCE(n.lg_code, u.lg_code),
      ward_code = COALESCE(n.ward_code, u.ward_code),
      registered_voters = COALESCE(n.registered_voters, u.registered_voters),
      latitude = COALESCE(n.latitude, u.latitude),
      longitude = COALESCE(n.longitude, u.longitude),
      address = COALESCE(n.address, u.address),
      geocode_status = CASE
        WHEN n.latitude IS NOT NULL AND n.longitude IS NOT NULL THEN 'done'::public.geocode_status
        ELSE COALESCE(u.geocode_status, 'pending'::public.geocode_status)
      END
    WHERE u.id = existing;
    RETURN existing;
  END IF;

  INSERT INTO public.polling_units (
    tenant_id, code, pu_code, name, ward, lga, state,
    state_code, lg_code, ward_code, registered_voters,
    latitude, longitude, address, geocode_status
  ) VALUES (
    p_tenant_id, n.code, n.pu_code, n.name, n.ward, n.lga, n.state,
    n.state_code, n.lg_code, n.ward_code, COALESCE(n.registered_voters, 0),
    n.latitude, n.longitude, n.address,
    CASE
      WHEN n.latitude IS NOT NULL AND n.longitude IS NOT NULL THEN 'done'::public.geocode_status
      ELSE 'pending'::public.geocode_status
    END
  )
  RETURNING id INTO created;

  RETURN created;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_tenant_polling_unit(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_tenant_polling_unit(uuid, uuid) TO authenticated, service_role;

COMMENT ON TABLE public.national_polling_units IS 'Shared Nigeria PU register; tenants narrow via State→Ward→PU cascade';
COMMENT ON FUNCTION public.ensure_tenant_polling_unit(uuid, uuid) IS 'Copy/link a national PU into a tenant for agent assignment';

NOTIFY pgrst, 'reload schema';
