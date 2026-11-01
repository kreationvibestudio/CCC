"use server";

import { createClient } from "@/lib/supabase/server";
import { authorize } from "@/lib/auth/session";
import { formatPollingUnitCode } from "@/lib/polling-units/code";
import { decodeWardValue, encodeWardValue } from "@/lib/agents/geo-encode";
import {
  listNationalPollingUnits,
  listNationalStates,
  listNationalWards,
} from "@/lib/polling-units/national";
import { getCampaignFocusState, defaultFocusFallback } from "@/lib/polling-units/focus-state";

export type AgentWardOption = {
  /** Encoded as `lga::ward` so duplicate ward names across LGAs stay unique. */
  value: string;
  label: string;
  ward: string;
  lga: string;
};

export type AgentPuOption = {
  /** National catalog id (materialized to tenant-local on save). */
  id: string;
  code: string;
  name: string;
  ward: string;
  lga: string;
  state: string;
  assigned: boolean;
};

/** Distinct states from the national catalog for agent registration. */
export async function getAgentRegistrationStates(): Promise<string[]> {
  const gate = await authorize("polling_units.view", "polling_units.manage", "admin.users");
  if (!gate.ok) return [];
  const states = await listNationalStates();
  if (states.length === 0) return [defaultFocusFallback()];
  return states;
}

export async function getAgentRegistrationFocusState(): Promise<string | null> {
  const gate = await authorize("polling_units.view", "polling_units.manage", "admin.users");
  if (!gate.ok) return null;
  return getCampaignFocusState(gate.user.profile.tenant_id);
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

  const pairs = await listNationalWards(trimmed);
  const wardNameCounts = new Map<string, number>();
  for (const { ward } of pairs) {
    wardNameCounts.set(ward, (wardNameCounts.get(ward) ?? 0) + 1);
  }

  return pairs
    .map(({ ward, lga }) => ({
      value: encodeWardValue(lga, ward),
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

  const units = await listNationalPollingUnits({
    state,
    lga: decoded.lga,
    ward: decoded.ward,
  });

  const tenantId = gate.user.profile.tenant_id;
  const supabase = await createClient();
  const codes = units.map((u) => u.code);
  const assignedCodes = new Set<string>();
  if (codes.length > 0) {
    const { data: local } = await supabase
      .from("polling_units")
      .select("code, assigned_agent_id")
      .eq("tenant_id", tenantId)
      .in("code", codes);
    for (const row of local ?? []) {
      if (row.assigned_agent_id && row.code) assignedCodes.add(String(row.code).toUpperCase());
    }
    // Also treat agents table occupancy as assigned for this tenant.
    const { data: agents } = await supabase
      .from("agents")
      .select("polling_unit_id")
      .eq("tenant_id", tenantId);
    const puIds = [...new Set((agents ?? []).map((a) => a.polling_unit_id).filter(Boolean))];
    if (puIds.length > 0) {
      const { data: occupied } = await supabase
        .from("polling_units")
        .select("code")
        .eq("tenant_id", tenantId)
        .in("id", puIds);
      for (const row of occupied ?? []) {
        if (row.code) assignedCodes.add(String(row.code).toUpperCase());
      }
    }
  }

  const out: AgentPuOption[] = [];
  for (const row of units) {
    const assigned = assignedCodes.has(row.code.toUpperCase());
    if (input.unassignedOnly && assigned) continue;
    out.push({
      id: row.id,
      code: formatPollingUnitCode(row),
      name: row.name,
      ward: row.ward,
      lga: row.lga,
      state: row.state,
      assigned,
    });
  }
  return out;
}
