"use server";

import { createClient } from "@/lib/supabase/server";
import { authorize } from "@/lib/auth/session";
import { applyCampaignStateFilter } from "@/lib/polling-units/scope";
import { formatPollingUnitCode } from "@/lib/polling-units/code";
import { decodeWardValue, encodeWardValue } from "@/lib/agents/geo-encode";

export type AgentWardOption = {
  /** Encoded as `lga::ward` so duplicate ward names across LGAs stay unique. */
  value: string;
  label: string;
  ward: string;
  lga: string;
};

export type AgentPuOption = {
  id: string;
  code: string;
  name: string;
  ward: string;
  lga: string;
  state: string;
  assigned: boolean;
};

async function distinctColumn(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  column: "state" | "ward" | "lga",
  filters?: { state?: string; lga?: string; ward?: string }
): Promise<string[]> {
  const names = new Set<string>();
  const pageSize = 1000;
  for (let from = 0; from < 30000; from += pageSize) {
    let q = applyCampaignStateFilter(
      supabase.from("polling_units").select(column).eq("tenant_id", tenantId)
    )
      .not(column, "is", null)
      .order("code");
    if (filters?.state) {
      const state = filters.state.trim();
      q = q.or(`state.eq.${state},state.ilike."${state}%"`);
    }
    if (filters?.lga) q = q.eq("lga", filters.lga);
    if (filters?.ward) q = q.eq("ward", filters.ward);
    const { data } = await q.range(from, from + pageSize - 1);
    const rows = (data ?? []) as Array<Record<string, string | null>>;
    for (const row of rows) {
      const value = row[column];
      if (value) names.add(value);
    }
    if (rows.length < pageSize) break;
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

/** Distinct campaign states available for agent registration. */
export async function getAgentRegistrationStates(): Promise<string[]> {
  const gate = await authorize("polling_units.view", "polling_units.manage", "admin.users");
  if (!gate.ok) return [];
  const supabase = await createClient();
  const states = await distinctColumn(supabase, gate.user.profile.tenant_id, "state");
  // Prefer canonical Edo label when present under variants.
  const normalized = new Map<string, string>();
  for (const s of states) {
    const key = s.trim().toUpperCase().startsWith("EDO") ? "Edo" : s.trim();
    if (!normalized.has(key.toUpperCase())) normalized.set(key.toUpperCase(), key === "Edo" ? "Edo" : s.trim());
  }
  return [...normalized.values()].sort((a, b) => a.localeCompare(b));
}

/**
 * Wards in a state. Value is `lga::ward` so HQ can disambiguate
 * wards that share a name across LGAs.
 */
export async function getAgentRegistrationWards(state: string): Promise<AgentWardOption[]> {
  const trimmed = state.trim();
  if (!trimmed) return [];
  const gate = await authorize("polling_units.view", "polling_units.manage", "admin.users");
  if (!gate.ok) return [];
  const supabase = await createClient();
  const tenantId = gate.user.profile.tenant_id;

  const pairs = new Map<string, { ward: string; lga: string }>();
  const pageSize = 1000;
  for (let from = 0; from < 30000; from += pageSize) {
    let q = applyCampaignStateFilter(
      supabase.from("polling_units").select("ward, lga, state").eq("tenant_id", tenantId)
    )
      .not("ward", "is", null)
      .not("lga", "is", null)
      .order("code");
    q = q.or(`state.eq.${trimmed},state.ilike."${trimmed}%",state.eq.${trimmed.toUpperCase()}`);
    const { data } = await q.range(from, from + pageSize - 1);
    const rows = (data ?? []) as Array<{ ward: string | null; lga: string | null }>;
    for (const row of rows) {
      if (!row.ward || !row.lga) continue;
      pairs.set(encodeWardValue(row.lga, row.ward), { ward: row.ward, lga: row.lga });
    }
    if (rows.length < pageSize) break;
  }

  const wardNameCounts = new Map<string, number>();
  for (const { ward } of pairs.values()) {
    wardNameCounts.set(ward, (wardNameCounts.get(ward) ?? 0) + 1);
  }

  return [...pairs.entries()]
    .map(([value, { ward, lga }]) => ({
      value,
      ward,
      lga,
      label: (wardNameCounts.get(ward) ?? 0) > 1 ? `${ward} (${lga})` : ward,
    }))
    .sort((a, b) => a.label.localeCompare(b.label) || a.lga.localeCompare(b.lga));
}

/** Polling units for a selected state + ward (ward value is `lga::ward`). */
export async function getAgentRegistrationPollingUnits(input: {
  state: string;
  wardValue: string;
  unassignedOnly?: boolean;
}): Promise<AgentPuOption[]> {
  const state = input.state.trim();
  const decoded = decodeWardValue(input.wardValue);
  if (!state || !decoded) return [];
  const gate = await authorize("polling_units.view", "polling_units.manage", "admin.users");
  if (!gate.ok) return [];
  const supabase = await createClient();
  const tenantId = gate.user.profile.tenant_id;

  const out: AgentPuOption[] = [];
  const pageSize = 500;
  for (let from = 0; from < 10000; from += pageSize) {
    let q = applyCampaignStateFilter(
      supabase
        .from("polling_units")
        .select("id, name, code, pu_code, ward, lga, state, assigned_agent_id")
        .eq("tenant_id", tenantId)
        .eq("lga", decoded.lga)
        .eq("ward", decoded.ward)
    ).order("code");
    q = q.or(`state.eq.${state},state.ilike."${state}%",state.eq.${state.toUpperCase()}`);
    if (input.unassignedOnly) q = q.is("assigned_agent_id", null);
    const { data } = await q.range(from, from + pageSize - 1);
    const rows = data ?? [];
    for (const row of rows) {
      out.push({
        id: row.id,
        code: formatPollingUnitCode(row),
        name: row.name,
        ward: row.ward,
        lga: row.lga,
        state: row.state,
        assigned: Boolean(row.assigned_agent_id),
      });
    }
    if (rows.length < pageSize) break;
  }
  return out;
}
