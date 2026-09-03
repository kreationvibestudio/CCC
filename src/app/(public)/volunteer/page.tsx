import { redirect } from "next/navigation";
import { getDefaultPublicCampaignSlug } from "@/lib/volunteers/public";

export const dynamic = "force-dynamic";

export default async function VolunteerIndexPage() {
  const slug = await getDefaultPublicCampaignSlug();
  redirect(`/volunteer/${slug}`);
}
