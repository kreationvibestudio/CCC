"use server";

import { authorize } from "@/lib/auth/session";
import {
  listNationalPollingUnits,
  listNationalStates,
  listNationalStatesForLgas,
  listNationalWardsInLga,
} from "@/lib/polling-units/national";
import { getCampaignFocusState, defaultFocusFallback } from "@/lib/polling-units/focus-state";
import { formatPollingUnitCode } from "@/lib/polling-units/code";

export type MemberPuOption = {
  id: string;
  code: string;
  name: string;
  ward: string;
  lga: string;
  state: string;
};

async function canReadGeo() {
  return authorize("members.view", "members.manage", "admin.users", "polling_units.view");
}

export async function getMemberRegistrationStates(): Promise<string[]> {
  const gate = await canReadGeo();
  if (!gate.ok) return [];
  const states = await listNationalStates();
  if (states.length === 0) return [defaultFocusFallback()];
  return states;
}

export async function getMemberRegistrationFocusState(): Promise<string | null> {
  const gate = await canReadGeo();
  if (!gate.ok) return null;
  return getCampaignFocusState(gate.user.profile.tenant_id);
}

export async function getMemberRegistrationLgas(state: string): Promise<string[]> {
  const trimmed = state.trim();
  if (!trimmed) return [];
  const gate = await canReadGeo();
  if (!gate.ok) return [];
  return listNationalStatesForLgas(trimmed);
}

export async function getMemberRegistrationWards(state: string, lga: string): Promise<string[]> {
  const trimmedState = state.trim();
  const trimmedLga = lga.trim();
  if (!trimmedState || !trimmedLga) return [];
  const gate = await canReadGeo();
  if (!gate.ok) return [];
  return listNationalWardsInLga(trimmedState, trimmedLga);
}

export async function getMemberRegistrationPollingUnits(input: {
  state: string;
  lga: string;
  ward: string;
}): Promise<MemberPuOption[]> {
  const state = input.state.trim();
  const lga = input.lga.trim();
  const ward = input.ward.trim();
  if (!state || !lga || !ward) return [];
  const gate = await canReadGeo();
  if (!gate.ok) return [];

  const units = await listNationalPollingUnits({ state, lga, ward });
  return units
    .map((u) => ({
      id: u.id,
      code: formatPollingUnitCode(u) || u.code,
      name: u.name ?? "",
      ward: u.ward,
      lga: u.lga,
      state: u.state,
    }))
    .sort((a, b) => a.code.localeCompare(b.code));
}
