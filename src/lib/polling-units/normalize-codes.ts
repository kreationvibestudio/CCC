import type { SupabaseClient } from "@supabase/supabase-js";
import { formatPollingUnitCode, isCanonicalPollingUnitCode, padPuCode } from "./code";

const COLS = "id, code, pu_code, name, ward, lga, state, state_code, lg_code, ward_code";

export async function normalizePollingUnitCodes(
  supabase: SupabaseClient,
  tenantId: string,
  limit = 200
): Promise<{ processed: number; updated: number; remaining: number }> {
  const { data, error } = await supabase
    .from("polling_units")
    .select(COLS)
    .eq("tenant_id", tenantId)
    .order("code")
    .limit(Math.min(Math.max(limit, 1), 400));
  if (error) throw new Error(error.message);

  let updated = 0;
  for (const row of data ?? []) {
    const next = formatPollingUnitCode(row);
    const nextPu = padPuCode(row.pu_code) || row.pu_code;
    if (!next || (isCanonicalPollingUnitCode(row.code) && nextPu === row.pu_code)) continue;
    if (next === row.code && nextPu === row.pu_code) continue;
    const { error: updateError } = await supabase
      .from("polling_units")
      .update({ code: next, pu_code: nextPu })
      .eq("id", row.id)
      .eq("tenant_id", tenantId);
    if (!updateError) updated += 1;
  }

  return { processed: data?.length ?? 0, updated, remaining: updated > 0 ? 1 : 0 };
}
