import { redirect } from "next/navigation";
import { getDefaultPublicCampaignSlug } from "@/lib/volunteers/public";

export default async function LearnIndexPage() {
  const slug = await getDefaultPublicCampaignSlug();
  redirect(`/learn/${slug}/login`);
}
