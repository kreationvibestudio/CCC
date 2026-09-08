-- Agent PU check-ins.
--
-- HQ needs to see when a Field Agent actually signed in at their assigned
-- unit: time, GPS distance from the pin, and whether they were inside the
-- 100 ft fence. last_used_at already existed; these columns add the location
-- details. agent_checkins keeps a history so later sign-ins are not lost.
--
-- Safe to re-run.

ALTER TABLE public.agent_access_codes
  ADD COLUMN IF NOT EXISTS last_login_distance_m INTEGER,
  ADD COLUMN IF NOT EXISTS last_login_gps_verified BOOLEAN,
  ADD COLUMN IF NOT EXISTS last_login_latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS last_login_longitude DOUBLE PRECISION;

CREATE TABLE IF NOT EXISTS public.agent_checkins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  polling_unit_id UUID NOT NULL REFERENCES public.polling_units(id) ON DELETE CASCADE,
  access_code_id UUID REFERENCES public.agent_access_codes(id) ON DELETE SET NULL,
  logged_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  distance_m INTEGER,
  gps_verified BOOLEAN NOT NULL DEFAULT FALSE,
  unit_code TEXT,
  unit_name TEXT
);

CREATE INDEX IF NOT EXISTS idx_agent_checkins_tenant_time
  ON public.agent_checkins (tenant_id, logged_in_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_checkins_profile
  ON public.agent_checkins (tenant_id, profile_id, logged_in_at DESC);

ALTER TABLE public.agent_checkins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS agent_checkins_select ON public.agent_checkins;
CREATE POLICY agent_checkins_select ON public.agent_checkins
  FOR SELECT USING (tenant_id = public.current_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.agent_checkins TO service_role;
GRANT SELECT ON TABLE public.agent_checkins TO authenticated;

COMMENT ON TABLE public.agent_checkins IS
  'Each successful CCC Agent code login at a polling unit.';
COMMENT ON COLUMN public.agent_access_codes.last_login_gps_verified IS
  'True when the last sign-in was within 100 ft of the assigned unit pin.';
