-- Provenance for polling-unit map pins.
-- Agent check-in (100 ft) is only safe for INEC CVR survey GPS or an HQ manual
-- paste taken at the real building. LGA-centroid approx and street geocode pins
-- are kilometres off and must not unlock Field Agent login.

ALTER TABLE public.polling_units
  ADD COLUMN IF NOT EXISTS pin_source TEXT;

ALTER TABLE public.national_polling_units
  ADD COLUMN IF NOT EXISTS pin_source TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'polling_units_pin_source_check'
  ) THEN
    ALTER TABLE public.polling_units
      ADD CONSTRAINT polling_units_pin_source_check
      CHECK (
        pin_source IS NULL
        OR pin_source IN ('inec_cvr', 'manual', 'street_geocode', 'approx')
      );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'national_polling_units_pin_source_check'
  ) THEN
    ALTER TABLE public.national_polling_units
      ADD CONSTRAINT national_polling_units_pin_source_check
      CHECK (
        pin_source IS NULL
        OR pin_source IN ('inec_cvr', 'manual', 'street_geocode', 'approx')
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_polling_units_pin_source
  ON public.polling_units (tenant_id, pin_source);

COMMENT ON COLUMN public.polling_units.pin_source IS
  'inec_cvr | manual | street_geocode | approx — only inec_cvr/manual unlock agent GPS check-in';
COMMENT ON COLUMN public.national_polling_units.pin_source IS
  'Shared catalog pin provenance; mirrored onto tenant rows on Align to INEC GPS';

NOTIFY pgrst, 'reload schema';
