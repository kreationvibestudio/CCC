-- HQ needs the full agent code next to the agent name (not only a last-four hint).
ALTER TABLE agent_access_codes
  ADD COLUMN IF NOT EXISTS code_display TEXT;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.agent_access_codes TO service_role;
GRANT SELECT ON TABLE public.agent_access_codes TO authenticated;
