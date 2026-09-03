import { getCurrentUser } from "@/lib/auth/session";
import { getPollingUnitLgas } from "@/lib/polling-units/actions";
import { getFieldStatusMapData } from "@/lib/maps/field-status";
import { VotersMapView } from "@/components/maps/voters-map-view";

export default async function MapsPage() {
  const user = await getCurrentUser();
  const [lgas, initial] = await Promise.all([
    getPollingUnitLgas(),
    getFieldStatusMapData(),
  ]);
  if (!user) return null;
  return <VotersMapView lgas={lgas} initial={initial} />;
}
