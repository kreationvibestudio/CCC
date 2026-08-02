import { getCurrentUser } from "@/lib/auth/session";
import { getPollingUnitsWithStatus } from "@/lib/polling-units/actions";
import { getDistinctLgasFromPUs } from "@/lib/geography/data";
import { PollingUnitsView } from "@/components/polling-units/polling-units-view";

export default async function PollingUnitsPage() {
  const user = await getCurrentUser();
  const tenantId = user!.profile.tenant_id;
  const [units, lgas] = await Promise.all([
    getPollingUnitsWithStatus(tenantId),
    getDistinctLgasFromPUs(tenantId),
  ]);
  return <PollingUnitsView units={units} lgas={lgas} />;
}
