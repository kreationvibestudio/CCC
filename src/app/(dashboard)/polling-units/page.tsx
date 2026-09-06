import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/types/auth";
import { getPollingUnitLgas, getPollingUnitSummary, countVotingActive } from "@/lib/polling-units/actions";
import { PollingUnitsView } from "@/components/polling-units/polling-units-view";

export default async function PollingUnitsPage() {
  const user = await getCurrentUser();
  const tenantId = user!.profile.tenant_id;
  const canManageAgents = Boolean(
    user &&
      (hasPermission(user.role, "polling_units.manage") || hasPermission(user.role, "admin.users"))
  );
  const [lgas, summary, votingActive] = await Promise.all([
    getPollingUnitLgas(),
    getPollingUnitSummary(),
    countVotingActive(),
  ]);
  return (
    <PollingUnitsView
      lgas={lgas}
      summary={summary}
      votingActive={votingActive}
      tenantId={tenantId}
      canManageAgents={canManageAgents}
    />
  );
}
