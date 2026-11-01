import type { SupabaseClient } from "@supabase/supabase-js";
import type { NormalizedPollingUnit } from "@/lib/polling-units/csv";
import { pollingUnitToDbRecord } from "@/lib/polling-units/to-db-record";
import { upsertNationalPollingUnits } from "@/lib/polling-units/national";

export async function upsertPollingUnitRows(
  supabase: SupabaseClient,
  tenantId: string,
  rows: NormalizedPollingUnit[]
): Promise<{ imported: number; failed: number; nationalUpserted?: number }> {
  let imported = 0;
  let failed = 0;

  for (const row of rows) {
    const { error } = await supabase
      .from("polling_units")
      .upsert(pollingUnitToDbRecord(tenantId, row), { onConflict: "tenant_id,code" });
    if (error) failed++;
    else imported++;
  }

  // Keep the shared Nigeria catalog in sync so every workspace can cascade-narrow.
  const national = await upsertNationalPollingUnits(
    rows.map((row) => ({
      code: row.code,
      name: row.name,
      ward: row.ward,
      lga: row.lga,
      state: row.state,
      pu_code: row.pu_code,
      state_code: row.state_code,
      lg_code: row.lg_code,
      ward_code: row.ward_code,
      registered_voters: row.registered_voters,
      latitude: row.latitude,
      longitude: row.longitude,
      address: row.address,
    }))
  );

  return { imported, failed, nationalUpserted: national.upserted };
}
