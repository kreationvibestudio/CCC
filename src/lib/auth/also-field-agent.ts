import type { Permission, UserRole } from "../../types/auth.ts";
import { ROLE_PERMISSIONS } from "../../types/auth.ts";

export const ALSO_FIELD_AGENT_COLUMN = "also_field_agent";

export const ALSO_FIELD_AGENT_MIGRATION_SQL = `-- Ward coordinators may also act as polling-unit field agents (HQ + Agent Portal).
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS also_field_agent BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN profiles.also_field_agent IS
  'When true and role is ward_coordinator, user keeps HQ ward views and also gets Field Agent / PU access';
`;

/** Only ward coordinators can hold the dual-access flag. */
export function resolveAlsoFieldAgent(role: UserRole, requested: boolean): boolean {
  return role === "ward_coordinator" && requested;
}

export function permissionsForRole(
  role: UserRole,
  flags?: { alsoFieldAgent?: boolean | null }
): Permission[] {
  const base = [...(ROLE_PERMISSIONS[role] ?? [])];
  if (resolveAlsoFieldAgent(role, Boolean(flags?.alsoFieldAgent)) && !base.includes("agent.portal")) {
    base.push("agent.portal");
  }
  return base;
}

/** Field-agent mobile/API + code login — pure agents, or dual ward coordinators. */
export function canAccessFieldAgentTools(
  role: UserRole,
  alsoFieldAgent?: boolean | null
): boolean {
  if (role === "polling_agent") return true;
  return resolveAlsoFieldAgent(role, Boolean(alsoFieldAgent));
}

export function readAlsoFieldAgentFlag(formData: FormData): boolean {
  const raw = formData.get("also_field_agent");
  return raw === "on" || raw === "true" || raw === "1";
}
