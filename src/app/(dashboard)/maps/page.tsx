import { getCurrentUser } from "@/lib/auth/session";
import { getPollingUnits } from "@/lib/polling-units/data";
import { PollingUnitsView } from "@/components/polling-units/polling-units-view";

export default async function MapsPage() {
  const user = await getCurrentUser();
  const units = await getPollingUnits(user!.profile.tenant_id);
  return <PollingUnitsView units={units} />;
}
