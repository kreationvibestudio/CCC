import { createClient } from "@/lib/supabase/server";

export async function getPollingUnits(tenantId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("polling_units")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("lga")
    .order("ward")
    .order("name");
  return data ?? [];
}

export async function getPollingUnitStatuses(tenantId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("polling_unit_status")
    .select("*, polling_units(name, ward, lga, latitude, longitude, registered_voters)")
    .eq("tenant_id", tenantId);
  return data ?? [];
}
