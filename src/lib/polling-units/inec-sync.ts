import type { SupabaseClient } from "@supabase/supabase-js";
import { formatPollingUnitCode, padPuCode, padWardCode } from "./code.ts";
import {
  INEC_STATE_FILES,
  loadInecStateUnits,
  nextInecState,
  resolveInecState,
  type InecRegisterUnit,
  type InecStateMeta,
} from "./inec-register.ts";

const EXISTING_COLS =
  "id, code, pu_code, name, ward, lga, state, state_code, lg_code, ward_code, address, latitude, longitude, assigned_agent_id";

export type ExistingPollingUnit = {
  id: string;
  code: string;
  pu_code: string | null;
  name: string;
  ward: string;
  lga: string;
  state: string;
  state_code: string | null;
  lg_code: string | null;
  ward_code: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  assigned_agent_id: string | null;
};

export type InecSyncResult = {
  state: string;
  fileName: string;
  processed: number;
  inserted: number;
  updated: number;
  failed: number;
  offset: number;
  nextOffset: number;
  stateTotal: number;
  stateRemaining: number;
  nextState: string | null;
  catalogStates: number;
  done: boolean;
};

function norm(value: string | null | undefined) {
  return (value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function matchInecUnit(
  unit: InecRegisterUnit,
  existing: ExistingPollingUnit[],
  usedIds: Set<string>
): ExistingPollingUnit | null {
  const available = existing.filter((row) => !usedIds.has(row.id));
  const byCode = available.find(
    (row) => row.code === unit.displayCode || row.code === unit.delimitation || formatPollingUnitCode(row) === unit.displayCode
  );
  if (byCode) return byCode;

  const byParts = available.filter((row) => {
    if (padPuCode(row.pu_code) !== unit.puCode) return false;
    if (padWardCode(row.ward_code) && padWardCode(row.ward_code) !== unit.wardCode) return false;
    const lg = padWardCode(row.lg_code);
    if (lg && lg !== unit.lgCode) return false;
    const state = padWardCode(row.state_code);
    if (state && state !== unit.stateCode) return false;
    return Boolean(padWardCode(row.ward_code) || lg || state);
  });
  if (byParts.length === 1) return byParts[0];

  const nameKey = norm(unit.name);
  if (!nameKey) return null;
  const byName = available.filter((row) => {
    if (norm(row.name) !== nameKey) return false;
    const sameLga =
      norm(row.lga) === norm(unit.lgaName) ||
      padWardCode(row.lg_code) === unit.lgCode ||
      norm(row.lga) === norm(unit.lgaToken);
    const sameWard =
      !row.ward ||
      norm(row.ward) === norm(unit.wardName) ||
      padWardCode(row.ward_code) === unit.wardCode;
    const sameState =
      !row.state ||
      norm(row.state) === norm(unit.stateToken) ||
      norm(row.state) === norm(unit.stateName) ||
      padWardCode(row.state_code) === unit.stateCode;
    return sameLga && sameWard && sameState;
  });
  if (byName.length === 1) return byName[0];
  const byNameWard = byName.filter(
    (row) => norm(row.ward) === norm(unit.wardName) || padWardCode(row.ward_code) === unit.wardCode
  );
  if (byNameWard.length === 1) return byNameWard[0];
  return null;
}

function inecToInsert(tenantId: string, unit: InecRegisterUnit) {
  return {
    tenant_id: tenantId,
    code: unit.displayCode,
    name: unit.name,
    ward: unit.wardName,
    lga: unit.lgaName,
    state: unit.stateToken,
    state_code: unit.stateCode,
    lg_code: unit.lgCode,
    ward_code: unit.wardCode,
    pu_code: unit.puCode,
    address: unit.name,
    registered_voters: 0,
    risk_level: "low" as const,
    geocode_status: "pending",
  };
}

function needsUpdate(row: ExistingPollingUnit, unit: InecRegisterUnit) {
  return (
    row.code !== unit.displayCode ||
    padPuCode(row.pu_code) !== unit.puCode ||
    padWardCode(row.ward_code) !== unit.wardCode ||
    padWardCode(row.lg_code) !== unit.lgCode ||
    padWardCode(row.state_code) !== unit.stateCode ||
    row.name !== unit.name ||
    row.ward !== unit.wardName ||
    row.lga !== unit.lgaName ||
    row.state !== unit.stateToken
  );
}

async function loadExistingForState(
  supabase: SupabaseClient,
  tenantId: string,
  meta: InecStateMeta
): Promise<ExistingPollingUnit[]> {
  const rows: ExistingPollingUnit[] = [];
  const stateFilter = [
    `state.eq.${meta.token}`,
    `state.ilike."%${meta.inecName}%"`,
    `state_code.eq.${meta.inecCode}`,
  ];
  if (meta.token === "FCT") stateFilter.push('state.ilike."%ABUJA%"');
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("polling_units")
      .select(EXISTING_COLS)
      .eq("tenant_id", tenantId)
      .or(stateFilter.join(","))
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    const chunk = (data ?? []) as ExistingPollingUnit[];
    rows.push(...chunk);
    if (chunk.length < 1000) break;
    from += 1000;
  }
  return rows;
}

export async function syncInecRegisterBatch(
  supabase: SupabaseClient,
  tenantId: string,
  options?: { state?: string; offset?: number; limit?: number }
): Promise<InecSyncResult> {
  const meta = resolveInecState(options?.state) ?? INEC_STATE_FILES[0];
  if (!meta) throw new Error("INEC state list is empty");
  const limit = Math.min(Math.max(options?.limit ?? 250, 1), 400);
  const offset = Math.max(options?.offset ?? 0, 0);
  const units = await loadInecStateUnits(meta.token);
  const batch = units.slice(offset, offset + limit);
  const existing = await loadExistingForState(supabase, tenantId, meta);
  const used = new Set<string>();
  const updates: Array<{ id: string; unit: InecRegisterUnit }> = [];
  const inserts: InecRegisterUnit[] = [];

  for (const unit of batch) {
    const match = matchInecUnit(unit, existing, used);
    if (match) {
      used.add(match.id);
      if (needsUpdate(match, unit)) updates.push({ id: match.id, unit });
    } else {
      inserts.push(unit);
    }
  }

  let updated = 0;
  let failed = 0;
  for (const item of updates) {
    const { error } = await supabase
      .from("polling_units")
      .update({
        code: item.unit.displayCode,
        name: item.unit.name,
        ward: item.unit.wardName,
        lga: item.unit.lgaName,
        state: item.unit.stateToken,
        state_code: item.unit.stateCode,
        lg_code: item.unit.lgCode,
        ward_code: item.unit.wardCode,
        pu_code: item.unit.puCode,
        address: item.unit.name,
      })
      .eq("id", item.id)
      .eq("tenant_id", tenantId);
    if (error) failed += 1;
    else updated += 1;
  }

  let inserted = 0;
  for (let i = 0; i < inserts.length; i += 80) {
    const chunk = inserts.slice(i, i + 80).map((unit) => inecToInsert(tenantId, unit));
    const { error } = await supabase.from("polling_units").upsert(chunk, {
      onConflict: "tenant_id,code",
      ignoreDuplicates: true,
    });
    if (!error) {
      inserted += chunk.length;
      continue;
    }
    for (const record of chunk) {
      const { error: rowError } = await supabase
        .from("polling_units")
        .upsert(record, { onConflict: "tenant_id,code", ignoreDuplicates: true });
      if (rowError) failed += 1;
      else inserted += 1;
    }
  }

  const nextOffset = offset + batch.length;
  const stateRemaining = Math.max(units.length - nextOffset, 0);
  const following = stateRemaining > 0 ? meta : nextInecState(meta.token);
  return {
    state: meta.token,
    fileName: meta.fileName,
    processed: batch.length,
    inserted,
    updated,
    failed,
    offset,
    nextOffset,
    stateTotal: units.length,
    stateRemaining,
    nextState: following?.token ?? null,
    catalogStates: INEC_STATE_FILES.length,
    done: !following || (stateRemaining === 0 && !nextInecState(meta.token)),
  };
}
