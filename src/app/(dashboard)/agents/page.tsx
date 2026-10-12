import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/types/auth";
import { listAgents } from "@/lib/agents/registration";
import { AgentsListView } from "@/components/agents/agents-list-view";

export default async function AgentsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?redirect=/agents");
  if (!hasPermission(user.role, "polling_units.manage") && !hasPermission(user.role, "admin.users")) {
    redirect("/polling-units");
  }
  const listed = await listAgents();
  return (
    <AgentsListView agents={listed.rows} needsAgentsMigration={listed.needsAgentsMigration} />
  );
}
