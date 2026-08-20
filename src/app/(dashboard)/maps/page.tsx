import { getPollingUnitLgas } from "@/lib/polling-units/actions";
import { VotersMapView } from "@/components/maps/voters-map-view";

export default async function MapsPage() {
  const lgas = await getPollingUnitLgas();
  return <VotersMapView lgas={lgas} />;
}
