import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/page-shell";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/types/auth";
import { agentsTableNeedsMigration } from "@/lib/agents/registration";
import { AgentRegistrationForm } from "@/components/agents/agent-registration-form";

export default async function NewAgentPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?redirect=/agents/new");
  if (!hasPermission(user.role, "polling_units.manage") && !hasPermission(user.role, "admin.users")) {
    redirect("/agents");
  }
  const needsAgentsMigration = await agentsTableNeedsMigration();
  return (
    <div className="mx-auto w-full max-w-3xl min-w-0 space-y-4 sm:space-y-6">
      <PageHeader
        title="Register agent"
        description="Capture agent paperwork, tie them to a polling unit, and issue a field login code"
      />
      <AgentRegistrationForm needsAgentsMigration={needsAgentsMigration} />
    </div>
  );
}
