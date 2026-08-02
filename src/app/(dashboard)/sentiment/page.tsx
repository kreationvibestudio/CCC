import { getCurrentUser } from "@/lib/auth/session";
import { getSentimentData } from "@/lib/sentiment/data";
import { SentimentView } from "@/components/sentiment/sentiment-view";

export default async function SentimentPage() {
  const user = await getCurrentUser();
  const tenantId = user!.profile.tenant_id;
  const data = await getSentimentData(tenantId);
  return <SentimentView tenantId={tenantId} {...data} />;
}
