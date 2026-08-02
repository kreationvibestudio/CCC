import { getCurrentUser } from "@/lib/auth/session";
import { getSituationRoomData } from "@/lib/situation-room/data";
import { SituationRoomView } from "@/components/situation-room/situation-room-view";

export default async function SituationRoomPage() {
  const user = await getCurrentUser();
  const tenantId = user!.profile.tenant_id;
  const data = await getSituationRoomData(tenantId);
  return <SituationRoomView tenantId={tenantId} {...data} />;
}
