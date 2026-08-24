import { formatPollingUnitCode, padPuCode } from "@/lib/polling-units/code";
import { isCampaignPollingUnit } from "@/lib/polling-units/scope";

/** Raw row from INEC CSV or legacy simplified CSV. */
export type PollingUnitCsvRow = Record<string, string | undefined>;

/** Normalized polling unit ready for database upsert. */
export type NormalizedPollingUnit = {
  code: string;
  name: string;
  ward: string;
  lga: string;
  state: string;
  state_code: string | null;
  lg_code: string | null;
  ward_code: string | null;
  pu_code: string | null;
  address: string | null;
  registered_voters: number;
  latitude: number | null;
  longitude: number | null;
};

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }

  result.push(current.trim());
  return result.map((value) => value.replace(/^"|"$/g, ""));
}

export function normalizePollingUnitRow(raw: PollingUnitCsvRow): NormalizedPollingUnit | null {
  const state = raw.state?.trim() || "Edo";
  const stateCode = raw.state_code?.trim() || null;
  const lgCode = raw.lg_code?.trim() || raw.lg?.trim() || null;
  const wardCode = raw.ward_code?.trim() || null;
  const puCode = raw.pu_code?.trim() || null;

  let code = raw.code?.trim();
  if (!code && stateCode && lgCode && wardCode && puCode) {
    code = `${stateCode}/${lgCode}/${wardCode}/${puCode}`;
  }
  if (!code) return null;
  if (!isCampaignPollingUnit({ state, state_code: stateCode, code })) return null;

  const location = raw.location?.trim() || raw.name?.trim() || code;
  const ward = raw.ward_des?.trim() || raw.ward?.trim() || "";
  const lga = raw.lg_des?.trim() || raw.lga?.trim() || raw.lg?.trim() || "";

  const lat = raw.latitude ? parseFloat(raw.latitude) : null;
  const lng = raw.longitude ? parseFloat(raw.longitude) : null;

  const formatted = formatPollingUnitCode({
    code,
    ward,
    lga,
    state,
    state_code: stateCode,
    lg_code: lgCode,
    ward_code: wardCode || raw.ward?.trim() || null,
    pu_code: puCode,
  });

  return {
    code: formatted || code,
    name: location,
    ward,
    lga,
    state,
    state_code: stateCode,
    lg_code: lgCode,
    ward_code: wardCode || raw.ward?.trim() || null,
    pu_code: padPuCode(puCode) || puCode,
    address: raw.address?.trim() || location,
    registered_voters: raw.registered_voters ? parseInt(raw.registered_voters, 10) : 0,
    latitude: lat != null && !Number.isNaN(lat) ? lat : null,
    longitude: lng != null && !Number.isNaN(lng) ? lng : null,
  };
}

export function parsePollingUnitsCsv(text: string): NormalizedPollingUnit[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() && !line.startsWith("#"));
  if (lines.length < 2) return [];

  const header = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const rows: NormalizedPollingUnit[] = [];

  for (const line of lines.slice(1)) {
    const vals = parseCsvLine(line);
    const raw: PollingUnitCsvRow = {};
    header.forEach((key, index) => {
      raw[key] = (vals[index] ?? "").trim();
    });

    const normalized = normalizePollingUnitRow(raw);
    if (normalized) rows.push(normalized);
  }

  return rows;
}
