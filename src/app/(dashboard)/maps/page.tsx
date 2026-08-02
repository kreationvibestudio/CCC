import { getCurrentUser } from "@/lib/auth/session";
import { getPollingUnitsWithStatus } from "@/lib/polling-units/actions";
import { getDistinctLgasFromPUs } from "@/lib/geography/data";
import { VotersMapView } from "@/components/maps/voters-map-view";

export default async function MapsPage() {
  const user = await getCurrentUser();
  const tenantId = user!.profile.tenant_id;
  const [units, lgas] = await Promise.all([
    getPollingUnitsWithStatus(tenantId),
    getDistinctLgasFromPUs(tenantId),
  ]);
  return <VotersMapView units={units} lgas={lgas} />;
}
