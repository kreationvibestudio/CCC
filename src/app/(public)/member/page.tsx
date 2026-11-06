import { redirect } from "next/navigation";
import { getDefaultPublicCampaignSlug } from "@/lib/volunteers/public";

export default async function MemberIndexPage() {
  const slug = await getDefaultPublicCampaignSlug();
  redirect(`/member/${slug}`);
}
