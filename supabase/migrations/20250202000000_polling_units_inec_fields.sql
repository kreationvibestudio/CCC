-- INEC polling unit field columns (official CSV export format)

ALTER TABLE polling_units
  ADD COLUMN IF NOT EXISTS state_code TEXT,
  ADD COLUMN IF NOT EXISTS lg_code TEXT,
  ADD COLUMN IF NOT EXISTS ward_code TEXT,
  ADD COLUMN IF NOT EXISTS pu_code TEXT;

CREATE INDEX IF NOT EXISTS idx_polling_units_pu_code ON polling_units(tenant_id, pu_code);
CREATE INDEX IF NOT EXISTS idx_polling_units_lg_code ON polling_units(tenant_id, lg_code);
