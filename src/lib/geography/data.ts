import { createClient } from "@/lib/supabase/server";

/** Supabase caps each response at 1,000 rows — page until exhausted. */
async function fetchAllRows<T>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  buildQuery: () => any,
  pageSize = 1000
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await buildQuery().range(from, to);
    if (error) throw error;
    const chunk = (data ?? []) as T[];
    rows.push(...chunk);
    if (chunk.length < pageSize) break;
  }
  return rows;
}

export async function getGeographyOptions() {
  const supabase = await createClient();
  const [{ data: lgas }, { data: wards }] = await Promise.all([
    supabase.from("lgas").select("id, name, states(name)").order("name"),
    supabase.from("wards").select("id, name, lga_id, lgas(name)").order("name"),
  ]);
  return { lgas: lgas ?? [], wards: wards ?? [] };
}

export async function getDistinctLgasFromPUs(tenantId: string) {
  const supabase = await createClient();
  const data = await fetchAllRows<{ lga: string }>(() =>
    supabase.from("polling_units").select("lga").eq("tenant_id", tenantId)
  );
  const set = new Set(data.map((r) => r.lga).filter(Boolean));
  return [...set].sort();
}

export async function getDistinctWardsFromPUs(tenantId: string, lga?: string) {
  const supabase = await createClient();
  const data = await fetchAllRows<{ ward: string }>(() => {
    let q = supabase.from("polling_units").select("ward").eq("tenant_id", tenantId);
    if (lga) q = q.eq("lga", lga);
    return q;
  });
  const set = new Set(data.map((r) => r.ward).filter(Boolean));
  return [...set].sort();
}
