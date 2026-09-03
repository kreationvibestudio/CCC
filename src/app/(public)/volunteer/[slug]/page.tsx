import { HandHeart } from "lucide-react";
import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BrandLogo } from "@/components/brand/logo";
import { PublicVolunteerSignupForm } from "@/components/volunteers/public-signup-form";
import { getPublicCampaignBySlug } from "@/lib/volunteers/public";

export const dynamic = "force-dynamic";

export default async function VolunteerSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const campaign = await getPublicCampaignBySlug(slug);
  if (!campaign) notFound();

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,oklch(0.42_0.12_145/0.14),transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(160deg,transparent_40%,oklch(0.35_0.08_85/0.08))]" />
      <Card className="relative z-10 w-full max-w-lg border-border/50 bg-card/95 shadow-lg backdrop-blur">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <BrandLogo size={40} className="rounded-md" priority />
          </div>
          <div className="mx-auto flex items-center justify-center gap-2 text-primary">
            <HandHeart className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-[0.14em]">Volunteer</span>
          </div>
          <CardTitle className="text-2xl leading-tight">Join {campaign.name}</CardTitle>
          <CardDescription className="text-sm leading-relaxed">
            Sign up to canvass, mobilize, and support the campaign on the ground. Your details go
            straight to the HQ volunteer desk.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PublicVolunteerSignupForm slug={campaign.slug} campaignName={campaign.name} />
        </CardContent>
      </Card>
    </div>
  );
}
