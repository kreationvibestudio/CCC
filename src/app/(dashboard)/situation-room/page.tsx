import { getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getPollingUnitStatuses } from "@/lib/polling-units/data";
import { SituationRoomView } from "@/components/situation-room/situation-room-view";

export default async function SituationRoomPage() {
  const user = await getCurrentUser();
  const tenantId = user!.profile.tenant_id;
  const supabase = await createClient();
  const [statuses, { data: incidents }] = await Promise.all([
    getPollingUnitStatuses(tenantId),
    supabase.from("incident_reports").select("id, title, severity, status, is_emergency, created_at").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(20),
  ]);
  return <SituationRoomView statuses={statuses} incidents={incidents ?? []} />;
}
