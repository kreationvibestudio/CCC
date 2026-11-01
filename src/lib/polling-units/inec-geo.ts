import { createServiceClient } from "@/lib/supabase/admin";
import { INEC_STATE_BY_CODE } from "@/lib/polling-units/code";
import {
  INEC_STATE_FILES,
  loadInecStateUnits,
  resolveInecState,
  type InecRegisterUnit,
} from "@/lib/polling-units/inec-register";

/** Title-case display label for an INEC state token / register name. */
export function inecDisplayStateName(unit: Pick<InecRegisterUnit, "stateName" | "stateToken">): string {
  const named = (unit.stateName || "").trim();
  if (named) {
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

/** All 36 states + FCT labels (no network). */
export function inecAllStateLabels(): string[] {
  return INEC_STATE_FILES.map((meta) =>
    inecDisplayStateName({ stateName: meta.inecName, stateToken: meta.token })
  ).sort((a, b) => a.localeCompare(b));
}

export async function listInecWards(state: string): Promise<Array<{ ward: string; lga: string }>> {
  const units = await loadInecStateUnits(state);
  const pairs = new Map<string, { ward: string; lga: string }>();
  for (const u of units) {
    if (!u.wardName || !u.lgaName) continue;
    pairs.set(`${u.lgaName}::${u.wardName}`, { ward: u.wardName, lga: u.lgaName });
  }
  return [...pairs.values()].sort(
    (a, b) => a.lga.localeCompare(b.lga) || a.ward.localeCompare(b.ward)
  );
}

export async function listInecUnits(input: {
  state: string;
  lga: string;
  ward: string;
}): Promise<InecRegisterUnit[]> {
  const units = await loadInecStateUnits(input.state);
  const lga = input.lga.trim().toLowerCase();
  const ward = input.ward.trim().toLowerCase();
  return units.filter(
    (u) => u.lgaName.trim().toLowerCase() === lga && u.wardName.trim().toLowerCase() === ward
  );
}

/**
 * Upsert INEC register rows into tenant-local `polling_units` (idempotent on tenant_id+code).
 * Used when the shared national catalog is missing or incomplete on production.
 */
export async function materializeInecUnitsForTenant(
  tenantId: string,
  units: InecRegisterUnit[]
): Promise<
  Array<{
    id: string;
    code: string;
    name: string;
    ward: string;
    lga: string;
    state: string;
  }>
> {
  if (units.length === 0) return [];
  const admin = createServiceClient();
  // Do not send `updated_at` — tenant `polling_units` has no such column
  // (only `national_polling_units` does). PostgREST rejects unknown columns.
  const payload = units.map((u) => ({
    tenant_id: tenantId,
    code: u.displayCode || u.delimitation,
    name: u.name,
    ward: u.wardName,
    lga: u.lgaName,
    state: inecDisplayStateName(u),
    pu_code: u.puCode,
    state_code: u.stateCode,
    lg_code: u.lgCode,
    ward_code: u.wardCode,
    address: u.name,
  }));

  const out: Array<{
    id: string;
    code: string;
    name: string;
    ward: string;
    lga: string;
    state: string;
  }> = [];

  const batchSize = 200;
  for (let i = 0; i < payload.length; i += batchSize) {
    const chunk = payload.slice(i, i + batchSize);
    const { data, error } = await admin
      .from("polling_units")
      .upsert(chunk, { onConflict: "tenant_id,code" })
      .select("id, code, name, ward, lga, state");
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      out.push({
        id: String(row.id),
        code: String(row.code),
        name: String(row.name),
        ward: String(row.ward),
        lga: String(row.lga),
        state: String(row.state),
      });
    }
  }
  return out;
}

export function isKnownInecState(raw: string): boolean {
  return Boolean(resolveInecState(raw) || INEC_STATE_BY_CODE[raw.padStart(2, "0")]);
}
