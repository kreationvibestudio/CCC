-- Agent access codes expire.
--
-- Codes were valid forever once issued: a code photographed off a printout
-- during one election stayed a working login into the next. Existing codes get
-- a 90-day window from the time this runs so nobody is locked out mid-cycle.
--
-- code_display now holds an AES-256-GCM blob rather than the code itself. Rows
-- written before this keep their plaintext and are readable until reissued, so
-- HQ printouts keep working; the comment records that the column is no longer
-- expected to be readable.
--
-- Safe to re-run.

ALTER TABLE public.agent_access_codes
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

UPDATE public.agent_access_codes
SET expires_at = now() + INTERVAL '90 days'
WHERE expires_at IS NULL
  AND revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_agent_access_codes_expires
  ON public.agent_access_codes (expires_at)
  WHERE revoked_at IS NULL;

COMMENT ON COLUMN public.agent_access_codes.code_display IS
  'Encrypted agent code (AES-256-GCM, "v1:iv:tag:ciphertext"). Legacy rows may hold plaintext until reissued.';
COMMENT ON COLUMN public.agent_access_codes.expires_at IS
  'Code stops working at this time. Set on issue from AGENT_CODE_TTL_DAYS.';
