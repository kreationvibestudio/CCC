/** SQL HQ can paste when cloud profiles lack the new agent identity columns. */
export const AGENT_IDENTITY_MIGRATION_SQL = `-- Field agent identity fields for HQ capture (PU Agents roster).
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS membership_card_number TEXT,
  ADD COLUMN IF NOT EXISTS voters_card_number TEXT,
  ADD COLUMN IF NOT EXISTS passport_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS is_lga_collation_agent BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_ward_collation_agent BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS nin TEXT,
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS nin_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS nin_verification JSONB;
`;

/** Full agents table SQL for cloud DBs that never ran the registration migration. */
export const AGENTS_TABLE_MIGRATION_SQL = `-- First-class field agent registration (HQ Agents module).
CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  polling_unit_id UUID NOT NULL REFERENCES polling_units(id) ON DELETE RESTRICT,
  profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  state TEXT,
  lga TEXT,
  ward TEXT,
  membership_card_number TEXT,
  voters_card_number TEXT,
  passport_photo_url TEXT,
  nin TEXT,
  date_of_birth DATE,
  nin_verified_at TIMESTAMPTZ,
  nin_verification JSONB,
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
CREATE INDEX IF NOT EXISTS agents_nin_idx ON agents (tenant_id, nin) WHERE nin IS NOT NULL;

ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_agents ON agents;
CREATE POLICY tenant_isolation_agents ON agents
  FOR ALL USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.agents TO authenticated, service_role;
`;

/** Incremental NIN columns when agents/profiles tables already exist. */
export const AGENT_NIN_MIGRATION_SQL = `-- Agent NIN / identity verification fields for HQ registration.
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

CREATE INDEX IF NOT EXISTS agents_nin_idx ON agents (tenant_id, nin) WHERE nin IS NOT NULL;
CREATE INDEX IF NOT EXISTS profiles_nin_idx ON profiles (tenant_id, nin) WHERE nin IS NOT NULL;
`;

export const AGENT_IDENTITY_COLUMNS = [
  "membership_card_number",
  "voters_card_number",
  "passport_photo_url",
  "is_lga_collation_agent",
  "is_ward_collation_agent",
  "nin",
  "date_of_birth",
  "nin_verified_at",
  "nin_verification",
] as const;

export type AgentCollationRole = "none" | "ward" | "lga";

export function normalizeCollationRole(input: {
  isLgaCollationAgent?: boolean;
  isWardCollationAgent?: boolean;
  collationRole?: string | null;
}): AgentCollationRole {
  const raw = (input.collationRole ?? "").trim().toLowerCase();
  if (raw === "lga" || raw === "lga_collation") return "lga";
  if (raw === "ward" || raw === "ward_collation") return "ward";
  if (input.isLgaCollationAgent && !input.isWardCollationAgent) return "lga";
  if (input.isWardCollationAgent && !input.isLgaCollationAgent) return "ward";
  return "none";
}

export function collationFlags(role: AgentCollationRole) {
  return {
    is_lga_collation_agent: role === "lga",
    is_ward_collation_agent: role === "ward",
  };
}

export function collationLabel(role: AgentCollationRole) {
  if (role === "lga") return "LGA collation agent";
  if (role === "ward") return "Ward collation agent";
  return null;
}
