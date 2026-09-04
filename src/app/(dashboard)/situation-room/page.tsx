import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/types/auth";
import { getSituationRoomData } from "@/lib/situation-room/data";
import { SituationRoomView } from "@/components/situation-room/situation-room-view";

export default async function SituationRoomPage() {
  const user = await getCurrentUser();
  const tenantId = user!.profile.tenant_id;
  const data = await getSituationRoomData(tenantId);
  const canReset = hasPermission(user!.role, "situation_room.manage");
  return <SituationRoomView tenantId={tenantId} canReset={canReset} {...data} />;
}
