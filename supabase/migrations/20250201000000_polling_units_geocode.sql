-- Polling units: geocode status + performance indexes

CREATE TYPE geocode_status AS ENUM ('pending', 'done', 'failed');

ALTER TABLE polling_units
  ADD COLUMN IF NOT EXISTS geocode_status geocode_status DEFAULT 'pending';

UPDATE polling_units SET geocode_status = 'done' WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
UPDATE polling_units SET geocode_status = 'pending' WHERE latitude IS NULL OR longitude IS NULL;

CREATE INDEX IF NOT EXISTS idx_polling_units_tenant_lga ON polling_units(tenant_id, lga);
CREATE INDEX IF NOT EXISTS idx_polling_units_tenant_ward ON polling_units(tenant_id, ward);
CREATE INDEX IF NOT EXISTS idx_polling_units_tenant_code ON polling_units(tenant_id, code);
CREATE INDEX IF NOT EXISTS idx_polling_units_geocode ON polling_units(tenant_id, geocode_status);

-- Campaign office / assistance center locations for voter map
CREATE TABLE IF NOT EXISTS campaign_locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  location_type TEXT NOT NULL DEFAULT 'campaign_office',
  address TEXT,
  ward TEXT,
  lga TEXT,
  state TEXT DEFAULT 'Edo',
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE campaign_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY campaign_locations_tenant ON campaign_locations
  FOR ALL USING (tenant_id = public.current_tenant_id());

-- Storage bucket note: create election-media bucket in Supabase Dashboard
