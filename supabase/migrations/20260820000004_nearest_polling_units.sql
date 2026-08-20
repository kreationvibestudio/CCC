-- Faster GPS nearest-PU lookup and PU-code search for Agent Portal.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_polling_units_lat_lng
  ON polling_units (tenant_id, latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_polling_units_code_trgm
  ON polling_units USING gin (code gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_polling_units_pu_code_trgm
  ON polling_units USING gin (pu_code gin_trgm_ops);

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
    AND u.latitude IS NOT NULL
    AND u.longitude IS NOT NULL
    AND u.latitude BETWEEN box.lat_min AND box.lat_max
    AND u.longitude BETWEEN box.lng_min AND box.lng_max
  ORDER BY distance_m
  LIMIT GREATEST(1, LEAST(p_limit, 25));
$$;

REVOKE ALL ON FUNCTION public.nearest_polling_units(double precision, double precision, integer, double precision) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.nearest_polling_units(double precision, double precision, integer, double precision) TO authenticated, service_role;
