"use server";

import { createServiceClient } from "@/lib/supabase/admin";
import { isMissingRelationError } from "@/lib/public-error";
import {
  inecAllStateLabels,
  listInecUnits,
  listInecWards,
} from "@/lib/polling-units/inec-geo";
import { defaultFocusFallback } from "@/lib/polling-units/focus-state";
import { formatPollingUnitCode } from "@/lib/polling-units/code";
import type { MemberPuOption } from "@/lib/members/geo-options";

/** Unauthenticated national catalog reads for the public member form. */
export async function getPublicMemberStates(): Promise<string[]> {
  try {
    const admin = createServiceClient();
    const { data, error } = await admin.rpc("national_pu_states");
    if (!error && Array.isArray(data) && data.length > 0) {
      return (data as Array<{ state: string }>)
        .map((r) => r.state)
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));
    }
  } catch {
    // fall through to INEC labels
  }
  const labels = inecAllStateLabels();
  return labels.length ? labels : [defaultFocusFallback()];
}

export async function getPublicMemberLgas(state: string): Promise<string[]> {
  const trimmed = state.trim();
  if (!trimmed) return [];
  const pairs = await publicWards(trimmed);
  return [...new Set(pairs.map((w) => w.lga))].sort((a, b) => a.localeCompare(b));
}

export async function getPublicMemberWards(state: string, lga: string): Promise<string[]> {
  const trimmedState = state.trim();
  const trimmedLga = lga.trim().toLowerCase();
  if (!trimmedState || !trimmedLga) return [];
  const pairs = await publicWards(trimmedState);
  return [
    ...new Set(
      pairs.filter((w) => w.lga.trim().toLowerCase() === trimmedLga).map((w) => w.ward)
    ),
  ].sort((a, b) => a.localeCompare(b));
}

export async function getPublicMemberPollingUnits(input: {
  state: string;
  lga: string;
  ward: string;
}): Promise<MemberPuOption[]> {
  const state = input.state.trim();
  const lga = input.lga.trim();
  const ward = input.ward.trim();
  if (!state || !lga || !ward) return [];

  try {
    const admin = createServiceClient();
    const { data, error } = await admin.rpc("national_pu_units", {
      p_state: state,
      p_lga: lga,
      p_ward: ward,
    });
    if (!error && Array.isArray(data) && data.length > 0) {
      return (data as Array<{
        id: string;
        code?: string | null;
        pu_code?: string | null;
        name?: string | null;
        ward: string;
        lga: string;
        state: string;
      }>)
        .map((u) => ({
          id: u.id,
          code: formatPollingUnitCode(u) || u.code || "",
          name: u.name ?? "",
          ward: u.ward,
          lga: u.lga,
          state: u.state,
        }))
        .sort((a, b) => a.code.localeCompare(b.code));
    }
    if (error && !isMissingRelationError(error.message, "national_polling_units")) {
      // continue to INEC fallback
    }
  } catch {
    // fall through
  }

  try {
    const inec = await listInecUnits({ state, lga, ward });
    return inec
      .map((u) => ({
        id: u.displayCode || u.delimitation,
        code: u.displayCode || u.delimitation,
        name: u.name || "",
        ward: u.wardName,
        lga: u.lgaName,
        state: u.stateName || state,
      }))
      .sort((a, b) => a.code.localeCompare(b.code));
  } catch {
    return [];
  }
}

async function publicWards(state: string): Promise<Array<{ ward: string; lga: string }>> {
  try {
    const admin = createServiceClient();
    const { data, error } = await admin.rpc("national_pu_wards", { p_state: state });
    if (!error && Array.isArray(data) && data.length > 0) {
      return (data as Array<{ ward: string; lga: string }>).filter((r) => r.ward && r.lga);
    }
  } catch {
    // fall through
  }
  try {
    return await listInecWards(state);
  } catch {
    return [];
  }
}
