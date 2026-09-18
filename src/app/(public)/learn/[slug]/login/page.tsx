import { redirect } from "next/navigation";
import { getPublicCampaignBySlug } from "@/lib/volunteers/public";
import { LearnLoginForm } from "@/components/lms/learn-login-form";
import { getLearnSession } from "@/lib/lms/learn-data";

export default async function LearnLoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ phone?: string | string[] }>;
}) {
  const { slug } = await params;
  const query = searchParams ? await searchParams : {};
  const phoneParam = query.phone;
  const defaultPhone = Array.isArray(phoneParam) ? phoneParam[0] : phoneParam;
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
      <LearnLoginForm slug={campaign.slug} campaignName={campaign.name} defaultPhone={defaultPhone} />
    </div>
  );
}
