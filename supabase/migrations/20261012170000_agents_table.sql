-- First-class field agent registration (HQ Agents module).
-- Identity paperwork lives here; profile_id ties to the system polling_agent login,
-- polling_unit_id ties to the assigned unit (also mirrored on polling_units.assigned_agent_id).

CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  polling_unit_id UUID NOT NULL REFERENCES polling_units(id) ON DELETE RESTRICT,
  profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  ward TEXT,
  membership_card_number TEXT,
  voters_card_number TEXT,
  passport_photo_url TEXT,
  is_lga_collation_agent BOOLEAN NOT NULL DEFAULT FALSE,
  is_ward_collation_agent BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, polling_unit_id)
);

CREATE INDEX IF NOT EXISTS agents_tenant_id_idx ON agents (tenant_id);
CREATE INDEX IF NOT EXISTS agents_profile_id_idx ON agents (profile_id);
CREATE INDEX IF NOT EXISTS agents_full_name_idx ON agents (tenant_id, full_name);

ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_agents ON agents;
CREATE POLICY tenant_isolation_agents ON agents
  FOR ALL USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.agents TO authenticated, service_role;

COMMENT ON TABLE agents IS 'HQ field-agent registration; unique per polling unit within a tenant';
COMMENT ON COLUMN agents.profile_id IS 'System polling_agent profile used for CCC Agent login codes';
COMMENT ON COLUMN agents.polling_unit_id IS 'Assigned polling unit (also set on polling_units.assigned_agent_id)';
