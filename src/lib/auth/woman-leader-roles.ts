export const WOMAN_LEADER_ROLE_KEYS = [
  "ward_woman_leader",
  "unit_woman_leader",
  "lga_woman_leader",
  "senatorial_woman_leader",
] as const;

export const WOMAN_LEADER_ROLES_MIGRATION_SQL = `-- Woman leader hierarchy roles for HQ invites.
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'ward_woman_leader';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'unit_woman_leader';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'lga_woman_leader';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'senatorial_woman_leader';
`;

export function isWomanLeaderRoleError(message: string | undefined): boolean {
  if (!message) return false;
  const hay = message.toLowerCase();
  return (
    hay.includes("user_role") &&
    (hay.includes("ward_woman_leader") ||
      hay.includes("unit_woman_leader") ||
      hay.includes("lga_woman_leader") ||
      hay.includes("senatorial_woman_leader") ||
      hay.includes("invalid input value for enum"))
  );
}
