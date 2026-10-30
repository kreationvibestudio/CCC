-- Agent NIN / identity verification fields for HQ registration.

ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS lga TEXT,
  ADD COLUMN IF NOT EXISTS nin TEXT,
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS nin_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS nin_verification JSONB;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS nin TEXT,
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS nin_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS nin_verification JSONB;

CREATE INDEX IF NOT EXISTS agents_nin_idx ON agents (tenant_id, nin)
  WHERE nin IS NOT NULL;
CREATE INDEX IF NOT EXISTS profiles_nin_idx ON profiles (tenant_id, nin)
  WHERE nin IS NOT NULL;

COMMENT ON COLUMN agents.nin IS 'National Identification Number (NIMC)';
COMMENT ON COLUMN agents.nin_verified_at IS 'When VerifyMe (or demo) last verified this NIN for the agent';
COMMENT ON COLUMN agents.nin_verification IS 'Sanitized VerifyMe NIN match payload (no secrets)';
COMMENT ON COLUMN agents.state IS 'State selected at registration (denormalized from polling unit)';
COMMENT ON COLUMN agents.lga IS 'LGA selected/resolved at registration (denormalized from polling unit)';
COMMENT ON COLUMN agents.date_of_birth IS 'Date of birth used for NIN identity matching';
