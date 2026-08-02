import { getCurrentUser } from "@/lib/auth/session";
import { getTemplates, getCampaigns } from "@/lib/communications/actions";
import { CommunicationsView } from "@/components/communications/communications-view";

export default async function CommunicationsPage() {
  const user = await getCurrentUser();
  const tenantId = user!.profile.tenant_id;
  const [templates, campaigns] = await Promise.all([getTemplates(tenantId), getCampaigns(tenantId)]);
  return <CommunicationsView templates={templates} campaigns={campaigns} />;
}
