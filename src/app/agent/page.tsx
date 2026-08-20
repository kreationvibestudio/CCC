import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/types/auth";
import { getAssignedPollingUnits } from "@/lib/agent/actions";
import { AgentPortalClient } from "@/components/agent/agent-portal-client";

export default async function AgentPortalPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?redirect=/agent");
  if (!hasPermission(user.role, "agent.portal")) redirect("/dashboard");
  const assigned = await getAssignedPollingUnits(user.id, user.profile.tenant_id);
  return <AgentPortalClient assigned={assigned} />;
}
