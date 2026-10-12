/** SQL HQ can paste when cloud profiles lack the new agent identity columns. */
export const AGENT_IDENTITY_MIGRATION_SQL = `-- Field agent identity fields for HQ capture (PU Agents roster).
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS membership_card_number TEXT,
  ADD COLUMN IF NOT EXISTS voters_card_number TEXT,
  ADD COLUMN IF NOT EXISTS passport_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS is_lga_collation_agent BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_ward_collation_agent BOOLEAN NOT NULL DEFAULT FALSE;
`;

export const AGENT_IDENTITY_COLUMNS = [
  "membership_card_number",
  "voters_card_number",
  "passport_photo_url",
  "is_lga_collation_agent",
  "is_ward_collation_agent",
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
