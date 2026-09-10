-- Campaign briefing record for HQ volunteer coordinators.
-- Safe to re-run. Does not change training_status defaults (signup/HQ add stay pending).

ALTER TABLE volunteers
  ADD COLUMN IF NOT EXISTS trained_at TIMESTAMPTZ;

ALTER TABLE volunteers
  ADD COLUMN IF NOT EXISTS training_notes TEXT;

COMMENT ON COLUMN volunteers.trained_at IS 'When HQ marked this volunteer trained (campaign briefing completed).';
COMMENT ON COLUMN volunteers.training_notes IS 'Optional HQ notes from the campaign briefing.';
