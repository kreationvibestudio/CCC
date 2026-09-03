import fs from "node:fs";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { applyCampaignStateFilter } from "./scope.ts";
import { approxPinForPollingUnit } from "./approx-pins.ts";

export type InecGpsRow = {
  state_code: string;
  lg_code: string;
  ward_code: string;
  pu_code: string;
  code: string;
  name: string;
  ward: string;
  lga: string;
  latitude: number;
  longitude: number;
  cvr_pu_id?: string;
};

const DEFAULT_CSV = path.join(process.cwd(), "supabase/data/edo-polling-unit-gps.csv");

/** Parse INEC CVR GPS CSV (from `npm run pu:fetch-gps`). */
export function parseInecGpsCsv(text: string): InecGpsRow[] {
  const lines = text.replace(/^\uFEFF/, "").trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const header = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name);
  const required = ["code", "latitude", "longitude"] as const;
  for (const key of required) {
    if (idx(key) < 0) throw new Error(`INEC GPS CSV missing column: ${key}`);
  }
  const rows: InecGpsRow[] = [];
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    const cols = splitCsvLine(line);
    const code = (cols[idx("code")] || "").trim();
    const latitude = Number(cols[idx("latitude")]);
    const longitude = Number(cols[idx("longitude")]);
    if (!code || !Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
    rows.push({
      state_code: (cols[idx("state_code")] || "").trim(),
      lg_code: (cols[idx("lg_code")] || "").trim(),
      ward_code: (cols[idx("ward_code")] || "").trim(),
      pu_code: (cols[idx("pu_code")] || "").trim(),
      code,
      name: (cols[idx("name")] || "").trim(),
      ward: (cols[idx("ward")] || "").trim(),
      lga: (cols[idx("lga")] || "").trim(),
      latitude,
      longitude,
      cvr_pu_id: idx("cvr_pu_id") >= 0 ? (cols[idx("cvr_pu_id")] || "").trim() : undefined,
    });
  }
  return rows;
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

export function loadInecGpsCsv(csvPath = DEFAULT_CSV): InecGpsRow[] {
  if (!fs.existsSync(csvPath)) {
    throw new Error(
      `Missing ${csvPath}. Run: npm run pu:fetch-gps  (scrapes official INEC CVR coordinates for Edo)`
    );
  }
  return parseInecGpsCsv(fs.readFileSync(csvPath, "utf8"));
}

export function isApproxStoredPin(row: {
  code?: string | null;
  name?: string | null;
  ward?: string | null;
  lga?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}) {
  if (row.latitude == null || row.longitude == null) return true;
  const approx = approxPinForPollingUnit(row);
  return (
    Math.abs(approx.latitude - Number(row.latitude)) < 1e-5 &&
    Math.abs(approx.longitude - Number(row.longitude)) < 1e-5
  );
}

/**
 * Apply official INEC CVR coordinates onto tenant polling units (match by PU code).
 * Prefer over LGA-centroid approx pins.
 */
export async function applyInecGpsForTenant(
  supabase: SupabaseClient,
  tenantId: string,
  options?: { limit?: number; csvPath?: string; force?: boolean; rows?: InecGpsRow[]; offset?: number }
): Promise<{
  updated: number;
  skipped: number;
  missing: number;
  remainingApprox: number;
  mapped: number;
  total: number;
  catalog: number;
  nextOffset: number;
  errors: string[];
  samples: Array<{ code: string; lat: number; lng: number }>;
}> {
  const limit = Math.min(Math.max(options?.limit ?? 200, 1), 200);
  const offset = Math.max(options?.offset ?? 0, 0);
  const catalog = options?.rows ?? loadInecGpsCsv(options?.csvPath);
  const force = Boolean(options?.force);
  const batch = catalog.slice(offset, offset + limit);
  const nextOffset = offset + batch.length;

  const errors: string[] = [];
  const samples: Array<{ code: string; lat: number; lng: number }> = [];
  let updated = 0;
  let skipped = 0;
  let missing = 0;

  if (batch.length) {
    const byCode = new Map<
      string,
      {
        id: string;
        code: string | null;
        name: string | null;
        ward: string | null;
        lga: string | null;
        latitude: number | null;
        longitude: number | null;
      }
    >();
    const chunkSize = 80;
    for (let i = 0; i < batch.length; i += chunkSize) {
      const codes = batch.slice(i, i + chunkSize).map((r) => r.code);
      const { data, error } = await applyCampaignStateFilter(
        supabase
          .from("polling_units")
          .select("id, code, name, ward, lga, latitude, longitude")
          .eq("tenant_id", tenantId)
          .in("code", codes)
      );
      if (error) throw new Error(`Could not load polling units: ${error.message}`);
      for (const row of data ?? []) {
        byCode.set(String(row.code || "").trim(), row);
      }
    }

    const updates: Array<{ id: string; code: string; latitude: number; longitude: number }> = [];

    for (const pin of batch) {
      const row = byCode.get(pin.code);
      if (!row) {
        missing += 1;
        continue;
      }
      const lat = Number(row.latitude);
      const lng = Number(row.longitude);
      const already =
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        Math.abs(lat - pin.latitude) < 1e-6 &&
        Math.abs(lng - pin.longitude) < 1e-6;
      if (already) {
        skipped += 1;
        continue;
      }
      if (!force && row.latitude != null && row.longitude != null && !isApproxStoredPin(row)) {
        skipped += 1;
        continue;
      }
      updates.push({ id: row.id, code: pin.code, latitude: pin.latitude, longitude: pin.longitude });
    }

    let cursor = 0;
    const workerCount = updates.length ? Math.min(40, updates.length) : 0;
    const results = await Promise.all(
      Array.from({ length: workerCount }, async () => {
        let localUpdated = 0;
        const localSamples: Array<{ code: string; lat: number; lng: number }> = [];
        const localErrors: string[] = [];
        while (true) {
          const i = cursor;
          cursor += 1;
          if (i >= updates.length) break;
          const u = updates[i];
          const { error: updErr } = await supabase
            .from("polling_units")
            .update({
              latitude: u.latitude,
              longitude: u.longitude,
              geocode_status: "done",
            })
            .eq("id", u.id)
            .eq("tenant_id", tenantId);
          if (updErr) localErrors.push(`${u.code}: ${updErr.message}`);
          else {
            localUpdated += 1;
            if (localSamples.length < 2) {
              localSamples.push({ code: u.code, lat: u.latitude, lng: u.longitude });
            }
          }
        }
        return { localUpdated, localSamples, localErrors };
      })
    );
    for (const r of results) {
      updated += r.localUpdated;
      errors.push(...r.localErrors);
      for (const s of r.localSamples) {
        if (samples.length < 8) samples.push(s);
      }
    }
  }

  const { data: checkRows } = await applyCampaignStateFilter(
    supabase
      .from("polling_units")
      .select("code, name, ward, lga, latitude, longitude")
      .eq("tenant_id", tenantId)
      .order("code")
      .limit(5000)
  );
  let remainingApprox = 0;
  for (const row of checkRows ?? []) {
    if (isApproxStoredPin(row)) remainingApprox += 1;
  }

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
    skipped,
    missing,
    remainingApprox,
    mapped: mapped ?? 0,
    total: total ?? 0,
    catalog: catalog.length,
    nextOffset,
    errors: errors.slice(0, 8),
    samples,
  };
}
