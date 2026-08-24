import type { SupabaseClient } from "@supabase/supabase-js";
import {
  canonicalLgaToken,
  canonicalStateToken,
  formatPollingUnitCode,
  formatPollingUnitCodeFromParts,
  inecNumericCode,
  inecNumericCodeFromParts,
  padPuCode,
  padWardCode,
  parsePollingUnitCode,
  type PollingUnitCodeInput,
} from "./code.ts";
import { applyCampaignStateFilter, isCampaignPollingUnit, isCampaignState } from "./scope.ts";

export type PollingUnitLookupRow = PollingUnitCodeInput & {
  id: string;
  code: string;
  name?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  assigned_agent_id?: string | null;
};

function unique(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => (value ?? "").trim()).filter(Boolean))];
}

export function sanitizePuLookupQuery(raw: string) {
  return raw.trim().slice(0, 96).replace(/[%(),"]/g, "");
}

/** Every stored form HQ/agents might type for the same unit. */
export function codeLookupVariants(raw: string): string[] {
  const query = sanitizePuLookupQuery(raw);
  if (!query) return [];
  const compact = query.toUpperCase().replace(/-/g, "/").replace(/\s+/g, "");
  const parsed = parsePollingUnitCode(query) || parsePollingUnitCode(compact);
  const formatted = parsed ? formatPollingUnitCodeFromParts(parsed) : "";
  const delim = parsed ? inecNumericCodeFromParts(parsed) : null;
  const paddedPu = padPuCode(query);
  return unique([query, query.toUpperCase(), compact, formatted, delim, paddedPu && paddedPu !== compact ? paddedPu : ""]);
}

export function unitMatchesLookupQuery(unit: PollingUnitLookupRow, raw: string): boolean {
  const query = raw.trim();
  if (!query) return false;
  const variants = new Set(codeLookupVariants(query).map((value) => value.toUpperCase()));
  const display = formatPollingUnitCode(unit).toUpperCase();
  const delim = (inecNumericCode(unit) ?? "").toUpperCase();
  const code = (unit.code ?? "").toUpperCase();
  const pu = (padPuCode(unit.pu_code) || unit.pu_code || "").toUpperCase();
  if (variants.has(code) || variants.has(display) || (delim && variants.has(delim))) return true;
  if (pu && variants.has(pu)) {
    const parsed = parsePollingUnitCode(query);
    if (!parsed) return variants.size <= 2;
  }
  const parsed = parsePollingUnitCode(query);
  if (parsed) {
    const unitParsed = parsePollingUnitCode(display) || parsePollingUnitCode(unit.code);
    if (
      unitParsed &&
      unitParsed.state === parsed.state &&
      unitParsed.lga === parsed.lga &&
      unitParsed.ward === parsed.ward &&
      unitParsed.pu === parsed.pu
    ) {
      return true;
    }
    if (padPuCode(unit.pu_code) === parsed.pu && padWardCode(unit.ward_code) === parsed.ward) {
      const unitLga = canonicalLgaToken(unit.lga, unit.state ?? unit.state_code ?? "", unit.lg_code);
      const queryLga = canonicalLgaToken(parsed.lga, parsed.state, parsed.lga);
      if (!parsed.lga || unitLga === queryLga || padWardCode(unit.lg_code) === padWardCode(parsed.lga)) return true;
    }
  }
  const name = (unit.name ?? "").toUpperCase();
  const needle = query.toUpperCase();
  if (needle.length >= 4 && /[A-Z]/.test(needle) && name.includes(needle)) return true;
  return false;
}

/** PostgREST `or()` clause so search hits display codes, INEC delimitations, and names. */
export function pollingUnitSearchOrFilter(raw: string): string {
  const query = sanitizePuLookupQuery(raw);
  if (query.length < 2) return "";
  const parsed = parsePollingUnitCode(query);
  const clauses: string[] = [];

  if (parsed) {
    const formatted = formatPollingUnitCodeFromParts(parsed);
    const delim = inecNumericCodeFromParts(parsed);
    clauses.push(`code.eq."${formatted}"`, `code.ilike."%${formatted}%"`);
    if (delim) {
      const [stateCode, lgCode, wardCode, puCode] = delim.split("/");
      clauses.push(`code.eq."${delim}"`);
      clauses.push(
        `and(state_code.eq.${stateCode},lg_code.eq.${lgCode},ward_code.eq.${wardCode},pu_code.eq.${puCode})`
      );
      clauses.push(`and(lg_code.eq.${lgCode},ward_code.eq.${wardCode},pu_code.eq.${puCode})`);
    }
    clauses.push(`and(ward_code.eq.${parsed.ward},pu_code.eq.${parsed.pu},lg_code.eq.${parsed.lga})`);
  } else {
    clauses.push(`code.ilike."%${query}%"`, `pu_code.ilike."%${query}%"`, `name.ilike."%${query}%"`);
    const padded = padPuCode(query);
    if (padded && /^\d+$/.test(query.replace(/\s/g, ""))) {
      clauses.push(`pu_code.eq."${padded}"`);
    }
  }

  return [...new Set(clauses)].join(",");
}

export async function findPollingUnitByCode<T extends PollingUnitLookupRow>(
  supabase: SupabaseClient,
  tenantId: string,
  raw: string,
  columns: string
): Promise<T | null> {
  const query = raw.trim();
  if (!query) return null;
  const parsedEarly = parsePollingUnitCode(query);
  if (parsedEarly?.state && !isCampaignState(parsedEarly.state)) return null;

  const accept = (row: T | null | undefined): T | null =>
    row && isCampaignPollingUnit(row) ? row : null;

  for (const candidate of codeLookupVariants(query)) {
    const { data } = await applyCampaignStateFilter(
      supabase.from("polling_units").select(columns).eq("tenant_id", tenantId).eq("code", candidate)
    ).limit(2);
    const rows = (data ?? []) as unknown as T[];
    if (rows.length === 1) return accept(rows[0]);
    const match = rows.find((row) => unitMatchesLookupQuery(row, query));
    if (match) return accept(match);
  }

  const parsed = parsePollingUnitCode(query);
  if (parsed) {
    const { data } = await applyCampaignStateFilter(
      supabase
        .from("polling_units")
        .select(columns)
        .eq("tenant_id", tenantId)
        .eq("pu_code", parsed.pu)
        .eq("ward_code", parsed.ward)
    ).limit(40);
    const matches = ((data ?? []) as unknown as T[]).filter((row) => unitMatchesLookupQuery(row, query));
    if (matches.length === 1) return accept(matches[0]);
    const formatted = formatPollingUnitCodeFromParts(parsed);
    const byDisplay = matches.find((row) => formatPollingUnitCode(row) === formatted);
    if (byDisplay) return accept(byDisplay);

    const delim = inecNumericCodeFromParts(parsed);
    if (delim) {
      const [stateCode, lgCode, wardCode, puCode] = delim.split("/");
      const { data: inec } = await applyCampaignStateFilter(
        supabase
          .from("polling_units")
          .select(columns)
          .eq("tenant_id", tenantId)
          .eq("state_code", stateCode)
          .eq("lg_code", lgCode)
          .eq("ward_code", wardCode)
          .eq("pu_code", puCode)
      ).limit(2);
      const rows = (inec ?? []) as unknown as T[];
      if (rows.length === 1) return accept(rows[0]);
    }
  }

  const padded = padPuCode(query);
  const digitsOnly = query.replace(/\s/g, "");
  if (padded && /^\d+$/.test(digitsOnly) && !query.includes("/")) {
    const { data } = await applyCampaignStateFilter(
      supabase.from("polling_units").select(columns).eq("tenant_id", tenantId).eq("pu_code", padded)
    ).limit(3);
    if (data?.length === 1) return accept(data[0] as unknown as T);
  }

  if (/[A-Za-z]/.test(query) && query.length >= 4) {
    const { data } = await applyCampaignStateFilter(
      supabase
        .from("polling_units")
        .select(columns)
        .eq("tenant_id", tenantId)
        .ilike("name", `%${sanitizePuLookupQuery(query)}%`)
    ).limit(8);
    const matches = ((data ?? []) as unknown as T[]).filter((row) => unitMatchesLookupQuery(row, query));
    if (matches.length === 1) return accept(matches[0]);
  }

  return null;
}

export function rankPollingUnitMatches<T extends PollingUnitLookupRow>(rows: T[], raw: string): T[] {
  const query = raw.trim().toUpperCase();
  const variants = new Set(codeLookupVariants(raw).map((value) => value.toUpperCase()));
  return [...rows].sort((a, b) => {
    const score = (unit: T) => {
      const display = formatPollingUnitCode(unit).toUpperCase();
      const delim = (inecNumericCode(unit) ?? "").toUpperCase();
      const code = (unit.code ?? "").toUpperCase();
      const pu = (unit.pu_code ?? "").toUpperCase();
      const state = canonicalStateToken(unit.state);
      if (variants.has(code) || variants.has(display) || (delim && variants.has(delim))) return 0;
      if (code.startsWith(query) || display.startsWith(query) || pu === query) return 1;
      if (state && display.includes(query)) return 2;
      return 3;
    };
    const diff = score(a) - score(b);
    if (diff !== 0) return diff;
    return formatPollingUnitCode(a).localeCompare(formatPollingUnitCode(b));
  });
}
