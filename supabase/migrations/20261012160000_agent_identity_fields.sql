-- Field agent identity fields for HQ capture (PU Agents roster).
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS membership_card_number TEXT,
  ADD COLUMN IF NOT EXISTS voters_card_number TEXT,
  ADD COLUMN IF NOT EXISTS passport_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS is_lga_collation_agent BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_ward_collation_agent BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN profiles.membership_card_number IS 'Campaign membership card number for field agents';
COMMENT ON COLUMN profiles.voters_card_number IS 'INEC voter card (PVC) number for field agents';
COMMENT ON COLUMN profiles.passport_photo_url IS 'Passport photograph URL for field agent ID';
COMMENT ON COLUMN profiles.is_lga_collation_agent IS 'Agent also serves as LGA collation agent';
COMMENT ON COLUMN profiles.is_ward_collation_agent IS 'Agent also serves as ward collation agent';
