import { createClient } from "@/lib/supabase/server";
import { isMissingColumnError } from "@/lib/public-error";

export async function getAdminData(tenantId: string) {
  const supabase = await createClient();
  const withFlag = await supabase
    .from("profiles")
    .select("id, full_name, email, role, ward, lga, also_field_agent, created_at")
    .eq("tenant_id", tenantId)
    .order("full_name");
  const profilesRes = isMissingColumnError(withFlag.error?.message, "also_field_agent")
    ? await supabase
        .from("profiles")
        .select("id, full_name, email, role, ward, lga, created_at")
        .eq("tenant_id", tenantId)
        .order("full_name")
    : withFlag;
  const { count } = await supabase
    .from("audit_logs")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantId);
  const profiles = (profilesRes.data ?? []).map((row) => ({
    ...row,
    also_field_agent: Boolean((row as { also_field_agent?: boolean }).also_field_agent),
  }));
  return { profiles, auditCount: count ?? 0 };
}
