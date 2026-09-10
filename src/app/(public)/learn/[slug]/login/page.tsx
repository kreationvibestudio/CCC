import { redirect } from "next/navigation";
import { getPublicCampaignBySlug } from "@/lib/volunteers/public";
import { LearnLoginForm } from "@/components/lms/learn-login-form";
import { getLearnSession } from "@/lib/lms/learn-data";

export default async function LearnLoginPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const campaign = await getPublicCampaignBySlug(slug);
  if (!campaign) redirect("/learn");
  const session = await getLearnSession();
  if (session) redirect(`/learn/${slug}`);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Open your training</h1>
        <p className="mt-1 text-sm text-muted-foreground">{campaign.name}</p>
      </div>
      <LearnLoginForm slug={campaign.slug} campaignName={campaign.name} />
    </div>
  );
}
