-- Confine HQ LGA/ward/summary/nearest RPCs to Edo State (INEC 12).

CREATE OR REPLACE FUNCTION public.campaign_polling_unit(u polling_units)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    coalesce(u.state_code, '') = '12'
    OR coalesce(u.state, '') ILIKE 'EDO%'
    OR coalesce(u.code, '') ILIKE 'EDO/%'
    OR coalesce(u.code, '') ILIKE '12/%';
$$;

REVOKE ALL ON FUNCTION public.campaign_polling_unit(polling_units) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.campaign_polling_unit(polling_units) TO authenticated, service_role;

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
    AND public.campaign_polling_unit(u)
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
    AND public.campaign_polling_unit(u)
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
    AND public.campaign_polling_unit(u)
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
    AND public.campaign_polling_unit(u)
    AND u.ward IS NOT NULL
    AND btrim(u.ward) <> ''
  GROUP BY u.ward
  ORDER BY voters DESC
  LIMIT GREATEST(1, LEAST(p_limit, 25));
$$;

CREATE OR REPLACE FUNCTION public.nearest_polling_units(
  p_lat double precision,
  p_lng double precision,
  p_limit integer DEFAULT 8,
  p_radius_km double precision DEFAULT 8
)
RETURNS TABLE (
  id uuid,
  code text,
  pu_code text,
  name text,
  ward text,
  lga text,
  latitude double precision,
  longitude double precision,
  distance_m double precision
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH box AS (
    SELECT
      p_lat - (p_radius_km / 111.32) AS lat_min,
      p_lat + (p_radius_km / 111.32) AS lat_max,
      p_lng - (p_radius_km / (111.32 * cos(radians(p_lat)))) AS lng_min,
      p_lng + (p_radius_km / (111.32 * cos(radians(p_lat)))) AS lng_max
  )
  SELECT
    u.id,
    u.code,
    u.pu_code,
    u.name,
    u.ward,
    u.lga,
    u.latitude,
    u.longitude,
    (6371000 * 2 * asin(sqrt(
      power(sin(radians((u.latitude - p_lat) / 2)), 2) +
      cos(radians(p_lat)) * cos(radians(u.latitude)) *
      power(sin(radians((u.longitude - p_lng) / 2)), 2)
    ))) AS distance_m
  FROM polling_units u, box
  WHERE u.tenant_id = public.current_tenant_id()
    AND public.campaign_polling_unit(u)
    AND u.latitude IS NOT NULL
    AND u.longitude IS NOT NULL
    AND u.latitude BETWEEN box.lat_min AND box.lat_max
    AND u.longitude BETWEEN box.lng_min AND box.lng_max
  ORDER BY distance_m
  LIMIT GREATEST(1, LEAST(p_limit, 25));
$$;
