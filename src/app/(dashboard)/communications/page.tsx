import { getTemplates, getCampaigns } from "@/lib/communications/actions";
import { CommunicationsView } from "@/components/communications/communications-view";

export default async function CommunicationsPage() {
  const [templates, campaigns] = await Promise.all([getTemplates(), getCampaigns()]);
  return <CommunicationsView templates={templates} campaigns={campaigns} />;
}
