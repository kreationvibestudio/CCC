import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  canonicalLgaToken,
  formatPollingUnitCodeFromParts,
  padPuCode,
  padWardCode,
} from "./code.ts";
import { createCvrClient, CVR_STATE_ID, type CvrClient, type CvrOption } from "./cvr-client.ts";
import { isApproxStoredPin, type InecGpsRow } from "./inec-cvr-gps.ts";
import type { InecRegisterUnit } from "./inec-register.ts";
import { applyCampaignStateFilter, CAMPAIGN_STATE } from "./scope.ts";

export type CvrPuNode = {
  id: string;
  code: string;
  name: string;
  lgaId: string;
  wardId: string;
  lgaCode: string;
  wardCode: string;
  lgaName: string;
  wardName: string;
  delimitation: string;
  displayCode: string;
};

export type CvrRegisterSnapshot = {
  fetchedAt: string;
  source: "cvr";
  stateId: string;
  units: CvrPuNode[];
};

const DEFAULT_MAX_AGE_MS = 6 * 60 * 60 * 1000;

function cacheDir() {
  return process.env.INEC_REGISTER_CACHE_DIR || "/tmp/inec-pu-register";
}

export function cvrCachePath() {
  return join(cacheDir(), "edo-cvr.json");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function mapPool<T, R>(items: T[], width: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(Math.max(width, 1), items.length || 1) }, async () => {
    while (i < items.length) {
      const idx = i;
      i += 1;
      out[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return out;
}

export function cvrNodeToRegisterUnit(node: CvrPuNode): InecRegisterUnit {
  return {
    delimitation: node.delimitation,
    displayCode: node.displayCode,
    name: node.name,
    stateName: "EDO",
    stateToken: CAMPAIGN_STATE,
    lgaName: node.lgaName,
    lgaToken: canonicalLgaToken(node.lgaName, CAMPAIGN_STATE, node.lgaCode),
    wardName: node.wardName,
    stateCode: CVR_STATE_ID,
    lgCode: node.lgaCode,
    wardCode: node.wardCode,
    puCode: node.code,
  };
}

export function flattenCvrOptionsToNode(input: {
  lga: CvrOption;
  ward: CvrOption;
  pu: CvrOption;
}): CvrPuNode | null {
  const lgaCode = padWardCode(input.lga.code);
  const wardCode = padWardCode(input.ward.code);
  const puCode = padPuCode(input.pu.code);
  if (!lgaCode || !wardCode || !puCode) return null;
  const lgaName = input.lga.label.trim();
  const lgaToken = canonicalLgaToken(lgaName, CAMPAIGN_STATE, lgaCode);
  return {
    id: input.pu.id,
    code: puCode,
    name: input.pu.label.trim() || puCode,
    lgaId: input.lga.id,
    wardId: input.ward.id,
    lgaCode,
    wardCode,
    lgaName,
    wardName: input.ward.label.trim() || wardCode,
    delimitation: `${CVR_STATE_ID}/${lgaCode}/${wardCode}/${puCode}`,
    displayCode: formatPollingUnitCodeFromParts({
      state: CAMPAIGN_STATE,
      lga: lgaToken,
      ward: wardCode,
      pu: puCode,
    }),
  };
}

export async function pollCvrEdoRegister(options?: {
  client?: CvrClient;
  concurrency?: number;
  onProgress?: (message: string) => void;
}): Promise<CvrRegisterSnapshot> {
  const client = options?.client ?? (await createCvrClient());
  const concurrency = Math.min(Math.max(options?.concurrency ?? 4, 1), 6);
  const log = options?.onProgress ?? (() => undefined);

  log("Fetching Edo LGAs from INEC CVR…");
  const lgas = await client.fetchOptions("lgas", "data[Search][state_id]", CVR_STATE_ID);
  if (!lgas.length) throw new Error("INEC CVR returned no Edo LGAs");

  const units: CvrPuNode[] = [];
  for (const [lgaIndex, lga] of lgas.entries()) {
    const wards = await client.fetchOptions("wards", "data[Search][local_government_id]", lga.id);
    log(`LGA ${lgaIndex + 1}/${lgas.length} ${lga.label}: ${wards.length} wards`);
    const wardBatches = await mapPool(wards, concurrency, async (ward) => {
      const pus = await client.fetchOptions("pus", "data[Search][registration_area_id]", ward.id);
      return pus
        .map((pu) => flattenCvrOptionsToNode({ lga, ward, pu }))
        .filter((node): node is CvrPuNode => Boolean(node));
    });
    for (const batch of wardBatches) units.push(...batch);
  }

  if (!units.length) throw new Error("INEC CVR returned no Edo polling units");
  log(`Polled ${units.length} Edo polling units from INEC CVR`);
  return {
    fetchedAt: new Date().toISOString(),
    source: "cvr",
    stateId: CVR_STATE_ID,
    units,
  };
}

export async function writeCvrSnapshot(snapshot: CvrRegisterSnapshot) {
  await mkdir(cacheDir(), { recursive: true });
  await writeFile(cvrCachePath(), JSON.stringify(snapshot));
}

export async function readCvrSnapshot(maxAgeMs = DEFAULT_MAX_AGE_MS): Promise<CvrRegisterSnapshot | null> {
  try {
    const text = await readFile(cvrCachePath(), "utf8");
    const parsed = JSON.parse(text) as CvrRegisterSnapshot;
    if (!parsed?.units?.length || parsed.source !== "cvr") return null;
    const age = Date.now() - Date.parse(parsed.fetchedAt);
    if (!Number.isFinite(age) || age > maxAgeMs) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function loadCvrEdoUnits(options?: {
  fresh?: boolean;
  client?: CvrClient;
  onProgress?: (message: string) => void;
}): Promise<{ units: InecRegisterUnit[]; snapshot: CvrRegisterSnapshot; source: "cvr" | "cache" }> {
  if (!options?.fresh) {
    const cached = await readCvrSnapshot();
    if (cached) {
      return {
        units: cached.units.map(cvrNodeToRegisterUnit),
        snapshot: cached,
        source: "cache",
      };
    }
  }
  const snapshot = await pollCvrEdoRegister({
    client: options?.client,
    onProgress: options?.onProgress,
  });
  try {
    await writeCvrSnapshot(snapshot);
  } catch {
    // cache is optional
  }
  return {
    units: snapshot.units.map(cvrNodeToRegisterUnit),
    snapshot,
    source: "cvr",
  };
}

export async function pollCvrGpsBatch(
  nodes: CvrPuNode[],
  options?: { client?: CvrClient; concurrency?: number }
): Promise<{ rows: InecGpsRow[]; errors: string[] }> {
  const client = options?.client ?? (await createCvrClient());
  const concurrency = Math.min(Math.max(options?.concurrency ?? 2, 1), 4);
  const rows: InecGpsRow[] = [];
  const errors: string[] = [];

  await mapPool(nodes, concurrency, async (node) => {
    try {
      let pin;
      try {
        pin = await client.locate(node.lgaId, node.wardId, node.id);
      } catch {
        await sleep(400);
        pin = await client.locate(node.lgaId, node.wardId, node.id);
      }
      rows.push({
        state_code: CVR_STATE_ID,
        lg_code: node.lgaCode,
        ward_code: node.wardCode,
        pu_code: node.code,
        code: node.delimitation,
        name: node.name,
        ward: node.wardName,
        lga: node.lgaName,
        latitude: pin.latitude,
        longitude: pin.longitude,
        cvr_pu_id: node.id,
      });
    } catch (error) {
      errors.push(`${node.delimitation}: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  return { rows, errors };
}

export async function pollCvrGpsForTenant(
  supabase: SupabaseClient,
  tenantId: string,
  options?: { limit?: number; force?: boolean; client?: CvrClient }
): Promise<{
  updated: number;
  skipped: number;
  missing: number;
  remaining: number;
  remainingApprox: number;
  mapped: number;
  total: number;
  processed: number;
  catalog: number;
  nextOffset: number;
  samples: Array<{ code: string; lat: number; lng: number }>;
  errors: string[];
  source: "cvr";
}> {
  const limit = Math.min(Math.max(options?.limit ?? 12, 1), 20);
  const loaded = await loadCvrEdoUnits({ client: options?.client });
  const byCode = new Map<string, CvrPuNode>();
  for (const node of loaded.snapshot.units) {
    byCode.set(node.delimitation, node);
    byCode.set(node.displayCode, node);
  }

  const { data, error } = await applyCampaignStateFilter(
    supabase
      .from("polling_units")
      .select("id, code, name, ward, lga, latitude, longitude")
      .eq("tenant_id", tenantId)
      .order("code")
      .limit(5000)
  );
  if (error) throw new Error(error.message);

  const pending: Array<{ node: CvrPuNode; id: string }> = [];
  const seen = new Set<string>();
  for (const row of data ?? []) {
    const code = String(row.code || "").trim();
    const node = byCode.get(code);
    if (!node || seen.has(node.id)) continue;
    const needs = row.latitude == null || row.longitude == null || isApproxStoredPin(row);
    if (!needs) continue;
    seen.add(node.id);
    pending.push({ node, id: row.id });
    if (pending.length >= limit) break;
  }

  const located = pending.length
    ? await pollCvrGpsBatch(
        pending.map((item) => item.node),
        { client: options?.client }
      )
    : { rows: [], errors: [] };

  const pinByDelimitation = new Map(located.rows.map((row) => [row.code, row]));
  const pinByCvrId = new Map(located.rows.map((row) => [row.cvr_pu_id || "", row]));
  let updated = 0;
  const samples: Array<{ code: string; lat: number; lng: number }> = [];
  const applyErrors = [...located.errors];

  for (const item of pending) {
    const pin = pinByCvrId.get(item.node.id) || pinByDelimitation.get(item.node.delimitation);
    if (!pin) continue;
    const { error: updErr } = await supabase
      .from("polling_units")
      .update({
        latitude: pin.latitude,
        longitude: pin.longitude,
        geocode_status: "done",
      })
      .eq("id", item.id)
      .eq("tenant_id", tenantId);
    if (updErr) applyErrors.push(`${item.node.displayCode}: ${updErr.message}`);
    else {
      updated += 1;
      if (samples.length < 8) samples.push({ code: item.node.displayCode, lat: pin.latitude, lng: pin.longitude });
    }
  }

  const stillNeed = (data ?? []).filter((row) => {
    const node = byCode.get(String(row.code || "").trim());
    if (!node) return false;
    if (pending.some((item) => item.node.id === node.id) && pinByCvrId.has(node.id)) return false;
    return row.latitude == null || row.longitude == null || isApproxStoredPin(row);
  }).length;

  const [{ count: total }, { count: mapped }] = await Promise.all([
    applyCampaignStateFilter(
      supabase.from("polling_units").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId)
    ),
    applyCampaignStateFilter(
      supabase
        .from("polling_units")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .not("latitude", "is", null)
        .not("longitude", "is", null)
    ),
  ]);

  return {
    updated,
    skipped: Math.max(pending.length - updated, 0),
    missing: 0,
    remaining: stillNeed,
    remainingApprox: stillNeed,
    mapped: mapped ?? 0,
    total: total ?? 0,
    processed: pending.length,
    catalog: loaded.snapshot.units.length,
    nextOffset: 0,
    samples,
    errors: applyErrors.slice(0, 8),
    source: "cvr",
  };
}
