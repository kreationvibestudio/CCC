import { createClient } from "@/lib/supabase/server";

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
  const { data } = await supabase.from("polling_units").select("lga").eq("tenant_id", tenantId);
  const set = new Set((data ?? []).map((r) => r.lga).filter(Boolean));
  return [...set].sort();
}

export async function getDistinctWardsFromPUs(tenantId: string, lga?: string) {
  const supabase = await createClient();
  let q = supabase.from("polling_units").select("ward").eq("tenant_id", tenantId);
  if (lga) q = q.eq("lga", lga);
  const { data } = await q;
  const set = new Set((data ?? []).map((r) => r.ward).filter(Boolean));
  return [...set].sort();
}
