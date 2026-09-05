import type { Permission } from "@/types/auth";

/**
 * Tables reachable through the generic module CRUD actions, with the permission
 * each operation needs and the columns a client may write.
 *
 * Identity columns are deliberately absent: `id`, `tenant_id`, `created_at` and
 * anything similar must never be settable from a request body.
 */
export type TableRule = {
  view: Permission;
  manage: Permission;
  columns: readonly string[];
};

export const TABLE_RULES = {
  polling_units: {
    view: "polling_units.view",
    manage: "polling_units.manage",
    columns: [
      "code",
      "pu_code",
      "name",
      "ward",
      "ward_code",
      "lga",
      "lg_code",
      "state",
      "state_code",
      "registered_voters",
      "latitude",
      "longitude",
      "address",
      "risk_level",
      "security_notes",
      "logistics",
      "assigned_agent_id",
      "geocode_status",
    ],
  },
  volunteers: {
    view: "volunteers.view",
    manage: "volunteers.manage",
    columns: [
      "full_name",
      "phone",
      "email",
      "ward",
      "lga",
      "polling_unit",
      "skills",
      "training_status",
      "availability",
      "notes",
    ],
  },
  contacts: {
    view: "crm.view",
    manage: "crm.manage",
    columns: [
      "full_name",
      "contact_type",
      "phone",
      "email",
      "ward",
      "lga",
      "support_level",
      "notes",
      "assigned_staff_id",
    ],
  },
  campaign_events: {
    view: "events.view",
    manage: "events.manage",
    columns: [
      "title",
      "event_type",
      "description",
      "location",
      "ward",
      "lga",
      "starts_at",
      "ends_at",
      "max_attendees",
    ],
  },
  message_templates: {
    view: "communications.view",
    manage: "communications.send",
    columns: ["name", "channel", "subject", "body"],
  },
  message_campaigns: {
    view: "communications.view",
    manage: "communications.send",
    columns: ["name", "channel", "template_id", "status", "scheduled_at"],
  },
} as const satisfies Record<string, TableRule>;

export type ManagedTable = keyof typeof TABLE_RULES;

export function isManagedTable(table: string): table is ManagedTable {
  return Object.hasOwn(TABLE_RULES, table);
}

/**
 * Split a client-supplied update into writable columns and rejected keys.
 * `undefined` values are dropped: a form that omits a field should leave it be.
 */
export function pickAllowedColumns(
  table: ManagedTable,
  updates: Record<string, unknown>
): { updates: Record<string, unknown>; rejected: string[] } {
  const allowed = new Set<string>(TABLE_RULES[table].columns);
  const picked: Record<string, unknown> = {};
  const rejected: string[] = [];

  for (const [key, value] of Object.entries(updates)) {
    if (!allowed.has(key)) {
      rejected.push(key);
      continue;
    }
    if (value === undefined) continue;
    picked[key] = value;
  }

  return { updates: picked, rejected };
}
