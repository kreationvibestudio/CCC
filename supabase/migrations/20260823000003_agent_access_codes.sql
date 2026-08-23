-- Field Agent app codes. Hash only; HQ sees the plaintext once (and on reset).
CREATE TABLE IF NOT EXISTS agent_access_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  polling_unit_id UUID NOT NULL REFERENCES polling_units(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  code_hint TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS agent_access_codes_hash_active
  ON agent_access_codes (code_hash)
  WHERE revoked_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS agent_access_codes_profile_active
  ON agent_access_codes (profile_id)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS agent_access_codes_tenant_pu
  ON agent_access_codes (tenant_id, polling_unit_id);

ALTER TABLE agent_access_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS agent_access_codes_select ON agent_access_codes;
CREATE POLICY agent_access_codes_select ON agent_access_codes
  FOR SELECT USING (tenant_id = public.current_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.agent_access_codes TO service_role;
GRANT SELECT ON TABLE public.agent_access_codes TO authenticated;
