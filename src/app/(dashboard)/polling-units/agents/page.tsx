import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/types/auth";
import { getAgentCoverage } from "@/lib/agents/actions";
import { AgentRosterView } from "@/components/polling-units/agent-roster-view";

export default async function PollingAgentsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?redirect=/polling-units/agents");
  if (!hasPermission(user.role, "polling_units.manage") && !hasPermission(user.role, "admin.users")) {
    redirect("/polling-units");
  }
  const coverage = await getAgentCoverage();
  return <AgentRosterView assignedPus={coverage.assignedPus} agents={coverage.agents} />;
}
