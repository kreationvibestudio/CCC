import type { SupabaseClient } from "@supabase/supabase-js";
import { INEC_STATE_FILES, loadInecStateUnits, type InecRegisterUnit } from "./inec-register.ts";
import { createServiceClient } from "../supabase/admin.ts";

function displayStateName(unit: InecRegisterUnit): string {
  const named = (unit.stateName || "").trim();
  if (named) {
    // Prefer title-ish casing from INEC ("KANO" → "Kano", keep FCT acronym).
    if (/^FCT|FEDERAL CAPITAL/i.test(named)) return "FCT";
    return named
      .toLowerCase()
      .split(/\s+/)
      .map((w) => (w.length <= 2 ? w.toUpperCase() : w[0]!.toUpperCase() + w.slice(1)))
      .join(" ")
      .replace(/\bOf\b/g, "of");
  }
  if (unit.stateToken === "FCT") return "FCT";
  if (unit.stateToken === "AKWA-IBOM") return "Akwa Ibom";
  if (unit.stateToken === "CROSS-RIVER") return "Cross River";
  return unit.stateToken
    .toLowerCase()
    .split("-")
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(" ");
}

type NationalRow = {
  code: string;
  name: string;
  ward: string;
  lga: string;
  state: string;
  pu_code: string;
  state_code: string;
  lg_code: string;
  ward_code: string;
  address: string;
  updated_at: string;
};

function toNationalRow(unit: InecRegisterUnit): NationalRow {
  return {
    code: unit.displayCode || unit.delimitation,
    name: unit.name,
    ward: unit.wardName,
    lga: unit.lgaName,
    state: displayStateName(unit),
    pu_code: unit.puCode,
    state_code: unit.stateCode,
    lg_code: unit.lgCode,
    ward_code: unit.wardCode,
    address: unit.name,
    updated_at: new Date().toISOString(),
  };
}

/** INEC JSON occasionally repeats delimitation codes; upsert batches must be unique on `code`. */
function dedupeByCode(rows: NationalRow[]): NationalRow[] {
  const map = new Map<string, NationalRow>();
  for (const row of rows) {
    const code = (row.code || "").trim();
    if (!code) continue;
    map.set(code, { ...row, code });
  }
  return [...map.values()];
}

export type SeedNationalProgress = {
  state: string;
  stateIndex: number;
  stateTotal: number;
  units: number;
  upserted: number;
  failed: number;
};

/**
 * Download every INEC state register and upsert into `national_polling_units`.
 * Idempotent on `code`. Does not touch tenant-local assignment rows.
 */
export async function seedNationalPollingUnitsCatalog(options?: {
  states?: string[];
  onProgress?: (p: SeedNationalProgress) => void;
  batchSize?: number;
  /** Injected by CLI scripts; defaults to service-role client in-app. */
  client?: SupabaseClient;
}): Promise<{ states: number; upserted: number; failed: number; errors: string[] }> {
  const admin = options?.client ?? createServiceClient();
  const batchSize = Math.min(Math.max(options?.batchSize ?? 500, 50), 1000);
  const wanted = options?.states?.map((s) => s.trim().toUpperCase()).filter(Boolean);
  const metas = wanted?.length
    ? INEC_STATE_FILES.filter((m) => wanted.includes(m.token) || wanted.includes(m.inecCode))
    : INEC_STATE_FILES;

  let upserted = 0;
  let failed = 0;
  const errors: string[] = [];

  for (let i = 0; i < metas.length; i += 1) {
    const meta = metas[i]!;
    let units: InecRegisterUnit[];
    try {
      units = await loadInecStateUnits(meta.token);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${meta.token}: ${msg}`);
      options?.onProgress?.({
        state: meta.token,
        stateIndex: i + 1,
        stateTotal: metas.length,
        units: 0,
        upserted,
        failed,
      });
      continue;
    }

    const rows = dedupeByCode(units.map(toNationalRow));
    for (let from = 0; from < rows.length; from += batchSize) {
      const chunk = rows.slice(from, from + batchSize);
      const { error, data } = await admin
        .from("national_polling_units")
        .upsert(chunk, { onConflict: "code" })
        .select("id");
      if (error) {
        failed += chunk.length;
        errors.push(`${meta.token} batch@${from}: ${error.message}`);
      } else {
        upserted += data?.length ?? chunk.length;
      }
    }

    options?.onProgress?.({
      state: meta.token,
      stateIndex: i + 1,
      stateTotal: metas.length,
      units: rows.length,
      upserted,
      failed,
    });
  }

  // Collapse legacy ALL-CAPS / token labels (e.g. backfilled "EDO") onto title-case names.
  for (const meta of metas) {
    const canonical = displayStateName({
      delimitation: "",
      displayCode: "",
      name: "",
      stateName: meta.inecName,
      stateToken: meta.token,
      lgaName: "",
      lgaToken: "",
      wardName: "",
      stateCode: meta.inecCode,
      lgCode: "",
      wardCode: "",
      puCode: "",
    });
    if (!canonical) continue;
    const now = new Date().toISOString();
    for (const legacy of new Set([meta.token, meta.inecName, meta.inecName.toLowerCase()])) {
      if (legacy === canonical) continue;
      const { error } = await admin
        .from("national_polling_units")
        .update({ state: canonical, updated_at: now })
        .eq("state", legacy);
      if (error) errors.push(`normalize ${meta.token}←${legacy}: ${error.message}`);
    }
  }

  return { states: metas.length, upserted, failed, errors };
}
