import { createClient } from "@/lib/supabase/server";

export async function getAdminData(tenantId: string) {
  const supabase = await createClient();
  const [{ data: profiles }, { count }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email, role, ward, created_at").eq("tenant_id", tenantId).order("full_name"),
    supabase.from("audit_logs").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId),
  ]);
  return { profiles: profiles ?? [], auditCount: count ?? 0 };
}
