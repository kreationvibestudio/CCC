import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/types/auth";
import { getAgent } from "@/lib/agents/registration";
import { AgentDetailView } from "@/components/agents/agent-detail-view";

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?redirect=/agents");
  if (!hasPermission(user.role, "polling_units.manage") && !hasPermission(user.role, "admin.users")) {
    redirect("/polling-units");
  }
  const { id } = await params;
  const result = await getAgent(id);
  if (result.error || !result.agent) notFound();
  return <AgentDetailView agent={result.agent} />;
}
