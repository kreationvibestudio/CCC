-- Optional invite ledger. HQ can still create Field Agent logins if this table
-- is missing; createInvitedAuthUser skips it and uses auth user_metadata.
-- Idempotent. Safe if 20260821000000_party_workspace_isolation.sql already ran.

CREATE TABLE IF NOT EXISTS tenant_invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'supporter',
  token TEXT NOT NULL UNIQUE,
  invited_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_invites_email ON tenant_invites (lower(email));
CREATE INDEX IF NOT EXISTS idx_tenant_invites_tenant ON tenant_invites (tenant_id);

ALTER TABLE tenant_invites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_invites_select ON tenant_invites;
CREATE POLICY tenant_invites_select ON tenant_invites
  FOR SELECT USING (tenant_id = public.current_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tenant_invites TO service_role;
GRANT SELECT ON TABLE public.tenant_invites TO authenticated;
