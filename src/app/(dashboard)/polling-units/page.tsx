import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/types/auth";
import {
  countVotingActive,
  getPollingUnitFocusState,
  getPollingUnitLgas,
  getPollingUnitStates,
  getPollingUnitSummary,
} from "@/lib/polling-units/actions";
import { PollingUnitsView } from "@/components/polling-units/polling-units-view";

export default async function PollingUnitsPage() {
  const user = await getCurrentUser();
  const tenantId = user!.profile.tenant_id;
  const canManageAgents = Boolean(
    user &&
      (hasPermission(user.role, "polling_units.manage") || hasPermission(user.role, "admin.users"))
  );
  const [states, focusState, votingActive] = await Promise.all([
    getPollingUnitStates(),
    getPollingUnitFocusState(),
    countVotingActive(),
  ]);
  const initialState =
    focusState && states.some((s) => s.toLowerCase() === focusState.toLowerCase())
      ? states.find((s) => s.toLowerCase() === focusState.toLowerCase())!
      : states.find((s) => s.toUpperCase().startsWith("EDO")) || states[0] || "";
  const [lgas, summary] = await Promise.all([
    initialState ? getPollingUnitLgas(initialState) : Promise.resolve([] as string[]),
    initialState
      ? getPollingUnitSummary({ state: initialState })
      : Promise.resolve({ puCount: 0, registeredVoters: 0, mapped: 0 }),
  ]);
  return (
    <PollingUnitsView
      states={states}
      initialState={initialState}
      focusState={focusState}
      lgas={lgas}
      summary={summary}
      votingActive={votingActive}
      tenantId={tenantId}
      canManageAgents={canManageAgents}
    />
  );
}
