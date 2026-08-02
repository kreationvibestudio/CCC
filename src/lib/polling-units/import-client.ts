import { createClient } from "@/lib/supabase/client";
import type { NormalizedPollingUnit } from "@/lib/polling-units/csv";
import { pollingUnitToDbRecord } from "@/lib/polling-units/to-db-record";

const BATCH_SIZE = 25;

export async function importPollingUnitsClient(
  tenantId: string,
  rows: NormalizedPollingUnit[],
  onProgress?: (done: number, total: number) => void
): Promise<{ imported: number; failed: number; error?: string }> {
  const supabase = createClient();
  let imported = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const records = batch.map((row) => pollingUnitToDbRecord(tenantId, row));

    const { error } = await supabase
      .from("polling_units")
      .upsert(records, { onConflict: "tenant_id,code" });

    if (error) {
      // Retry row-by-row when bulk upsert fails (e.g. one bad row)
      for (const record of records) {
        const { error: rowError } = await supabase
          .from("polling_units")
          .upsert(record, { onConflict: "tenant_id,code" });
        if (rowError) failed++;
        else imported++;
      }
    } else {
      imported += batch.length;
    }

    onProgress?.(Math.min(i + BATCH_SIZE, rows.length), rows.length);
  }

  return { imported, failed };
}
