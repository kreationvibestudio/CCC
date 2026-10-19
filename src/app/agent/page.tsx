import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { homePathForRole } from "@/types/auth";
import { getAssignedPollingUnits } from "@/lib/agent/actions";
import { AgentPortalClient } from "@/components/agent/agent-portal-client";

export default async function AgentPortalPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?redirect=/agent");
  if (!user.permissions.includes("agent.portal")) redirect(homePathForRole(user.role));
  const assigned = await getAssignedPollingUnits();
  return <AgentPortalClient assigned={assigned} />;
}
