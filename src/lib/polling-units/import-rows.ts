import type { SupabaseClient } from "@supabase/supabase-js";
import type { NormalizedPollingUnit } from "@/lib/polling-units/csv";
import { pollingUnitToDbRecord } from "@/lib/polling-units/to-db-record";

export async function upsertPollingUnitRows(
  supabase: SupabaseClient,
  tenantId: string,
  rows: NormalizedPollingUnit[]
): Promise<{ imported: number; failed: number }> {
  let imported = 0;
  let failed = 0;

  for (const row of rows) {
    const { error } = await supabase
      .from("polling_units")
      .upsert(pollingUnitToDbRecord(tenantId, row), { onConflict: "tenant_id,code" });
    if (error) failed++;
    else imported++;
  }

  return { imported, failed };
}
