/** SQL HQ can paste when cloud DBs never ran the unit_members migration. */
export const UNIT_MEMBERS_TABLE_MIGRATION_SQL = `-- NDC unit member registration (HQ Members module).
CREATE TABLE IF NOT EXISTS unit_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  polling_unit_id UUID REFERENCES polling_units(id) ON DELETE SET NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  voters_card_number TEXT NOT NULL,
  membership_card_number TEXT NOT NULL,
  state TEXT,
  lga TEXT NOT NULL,
  ward TEXT NOT NULL,
  unit_code TEXT,
  unit_name TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, phone),
  UNIQUE (tenant_id, voters_card_number),
  UNIQUE (tenant_id, membership_card_number)
);

CREATE INDEX IF NOT EXISTS unit_members_tenant_id_idx ON unit_members (tenant_id);
CREATE INDEX IF NOT EXISTS unit_members_lga_ward_idx ON unit_members (tenant_id, lga, ward);
CREATE INDEX IF NOT EXISTS unit_members_polling_unit_id_idx ON unit_members (polling_unit_id);
CREATE INDEX IF NOT EXISTS unit_members_name_idx ON unit_members (tenant_id, last_name, first_name);

ALTER TABLE unit_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_unit_members ON unit_members;
CREATE POLICY tenant_isolation_unit_members ON unit_members
  FOR ALL USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.unit_members TO authenticated, service_role;
`;
