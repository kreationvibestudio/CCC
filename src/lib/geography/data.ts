import { createClient } from "@/lib/supabase/server";

export async function getGeographyOptions() {
  const supabase = await createClient();
  const [{ data: lgas }, { data: wards }] = await Promise.all([
    supabase.from("lgas").select("id, name, states(name)").order("name"),
    supabase.from("wards").select("id, name, lga_id, lgas(name)").order("name"),
  ]);
  return { lgas: lgas ?? [], wards: wards ?? [] };
}

export async function getDistinctLgasFromPUs() {
  const supabase = await createClient();
  const rpc = await supabase.rpc("distinct_polling_lgas");
  if (!rpc.error && Array.isArray(rpc.data)) {
    return rpc.data
      .map((row: { lga?: string }) => row.lga)
      .filter((name): name is string => Boolean(name));
  }
  const { data } = await supabase.from("lgas").select("name").order("name");
  return (data ?? []).map((row) => row.name).filter(Boolean);
}

export async function getDistinctWardsFromPUs(lga?: string) {
  const supabase = await createClient();
  if (!lga) return [];
  const rpc = await supabase.rpc("distinct_polling_wards", { p_lga: lga });
  if (!rpc.error && Array.isArray(rpc.data)) {
    return rpc.data
      .map((row: { ward?: string }) => row.ward)
      .filter((name): name is string => Boolean(name));
  }
  return [];
}
