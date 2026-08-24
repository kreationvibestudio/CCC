import type { SupabaseClient } from "@supabase/supabase-js";
import { formatPollingUnitCode, padPuCode, padWardCode } from "./code.ts";
import { CAMPAIGN_STATE, CAMPAIGN_STATE_CODE, isCampaignPollingUnit } from "./scope.ts";
import {
  loadInecStateUnits,
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
  pruned: number;
  pruneRemaining: number;
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

async function loadByCodes(
  supabase: SupabaseClient,
  tenantId: string,
  codes: string[]
): Promise<ExistingPollingUnit[]> {
  const rows: ExistingPollingUnit[] = [];
  for (let i = 0; i < codes.length; i += 80) {
    const slice = codes.slice(i, i + 80);
    if (!slice.length) continue;
    const { data, error } = await supabase
      .from("polling_units")
      .select(EXISTING_COLS)
      .eq("tenant_id", tenantId)
      .in("code", slice);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as ExistingPollingUnit[]));
  }
  return rows;
}

async function loadExistingForBatch(
  supabase: SupabaseClient,
  tenantId: string,
  meta: InecStateMeta,
  batch: InecRegisterUnit[]
): Promise<ExistingPollingUnit[]> {
  const codes = [...new Set(batch.flatMap((unit) => [unit.displayCode, unit.delimitation]))];
  const rows = await loadByCodes(supabase, tenantId, codes);
  const seen = new Set(rows.map((row) => row.id));

  const puCodes = [...new Set(batch.map((unit) => unit.puCode))];
  for (let i = 0; i < puCodes.length; i += 80) {
    const slice = puCodes.slice(i, i + 80);
    const { data, error } = await supabase
      .from("polling_units")
      .select(EXISTING_COLS)
      .eq("tenant_id", tenantId)
      .eq("state_code", meta.inecCode)
      .in("pu_code", slice);
    if (error) break;
    for (const row of (data ?? []) as ExistingPollingUnit[]) {
      if (!seen.has(row.id)) {
        seen.add(row.id);
        rows.push(row);
      }
    }
  }
  return rows;
}

async function deletePollingUnitsById(
  supabase: SupabaseClient,
  tenantId: string,
  ids: string[]
): Promise<void> {
  if (!ids.length) return;
  const { error: resultsError } = await supabase.from("election_results").delete().in("polling_unit_id", ids);
  if (resultsError) throw new Error(resultsError.message);
  const { error: incidentsError } = await supabase
    .from("incident_reports")
    .update({ polling_unit_id: null })
    .in("polling_unit_id", ids);
  if (incidentsError) throw new Error(incidentsError.message);
  const { error: reportsError } = await supabase
    .from("agent_reports")
    .update({ polling_unit_id: null })
    .in("polling_unit_id", ids);
  if (reportsError) throw new Error(reportsError.message);
  const { error: deleteError } = await supabase.from("polling_units").delete().eq("tenant_id", tenantId).in("id", ids);
  if (deleteError) throw new Error(deleteError.message);
}

export async function pruneNonCampaignPollingUnits(
  supabase: SupabaseClient,
  tenantId: string,
  limit = 400
): Promise<{ pruned: number; remaining: number }> {
  const page = Math.min(Math.max(limit, 1), 1000);
  const { data, error } = await supabase
    .from("polling_units")
    .select("id, state, state_code, code")
    .eq("tenant_id", tenantId)
    .or(`state_code.neq.${CAMPAIGN_STATE_CODE},state_code.is.null`)
    .limit(page);
  if (error) throw new Error(error.message);
  const fetched = (data ?? []) as Array<{ id: string; state: string | null; state_code: string | null; code: string }>;
  const ids = fetched.filter((row) => !isCampaignPollingUnit(row)).map((row) => row.id);
  const moreOnPage = fetched.length >= page;
  if (ids.length) {
    await deletePollingUnitsById(supabase, tenantId, ids);
    return { pruned: ids.length, remaining: moreOnPage ? 1 : 0 };
  }
  const fallback = await supabase
    .from("polling_units")
    .select("id, state, state_code, code")
    .eq("tenant_id", tenantId)
    .not("state", "ilike", "%EDO%")
    .limit(page);
  if (fallback.error) throw new Error(fallback.error.message);
  const extraFetched = (fallback.data ?? []) as Array<{
    id: string;
    state: string | null;
    state_code: string | null;
    code: string;
  }>;
  const extra = extraFetched.filter((row) => !isCampaignPollingUnit(row)).map((row) => row.id);
  if (!extra.length) return { pruned: 0, remaining: 0 };
  await deletePollingUnitsById(supabase, tenantId, extra);
  return { pruned: extra.length, remaining: extraFetched.length >= page ? 1 : 0 };
}

export async function syncInecRegisterBatch(
  supabase: SupabaseClient,
  tenantId: string,
  options?: { state?: string; offset?: number; limit?: number; pruneOnly?: boolean }
): Promise<InecSyncResult> {
  if (options?.pruneOnly) {
    const prune = await pruneNonCampaignPollingUnits(supabase, tenantId, options.limit ?? 400);
    return {
      state: CAMPAIGN_STATE,
      fileName: "edo.json",
      processed: 0,
      inserted: 0,
      updated: 0,
      failed: 0,
      offset: 0,
      nextOffset: 0,
      stateTotal: 0,
      stateRemaining: 0,
      nextState: null,
      catalogStates: 1,
      pruned: prune.pruned,
      pruneRemaining: prune.remaining,
      done: prune.remaining === 0,
    };
  }
  const meta = resolveInecState(options?.state || CAMPAIGN_STATE) ?? resolveInecState(CAMPAIGN_STATE);
  if (!meta || meta.token !== CAMPAIGN_STATE) {
    throw new Error("Polling units are confined to Edo State");
  }
  const limit = Math.min(Math.max(options?.limit ?? 250, 1), 400);
  const offset = Math.max(options?.offset ?? 0, 0);
  const units = await loadInecStateUnits(meta.token);
  const batch = units.slice(offset, offset + limit);
  const existing = await loadExistingForBatch(supabase, tenantId, meta, batch);
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
  let pruned = 0;
  let pruneRemaining = 0;
  if (stateRemaining === 0) {
    const prune = await pruneNonCampaignPollingUnits(supabase, tenantId, 400);
    pruned = prune.pruned;
    pruneRemaining = prune.remaining;
  }
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
    nextState: stateRemaining > 0 ? meta.token : null,
    catalogStates: 1,
    pruned,
    pruneRemaining,
    done: stateRemaining === 0 && pruneRemaining === 0,
  };
}
