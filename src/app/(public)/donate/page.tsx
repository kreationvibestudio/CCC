import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/admin";
import { CAMPAIGN_TENANT_ID } from "@/lib/campaign";

export const dynamic = "force-dynamic";

export default async function DonateIndexPage() {
  let slug = "campaign";
  try {
    const admin = createServiceClient();
    const { data } = await admin.from("tenants").select("slug").eq("id", CAMPAIGN_TENANT_ID).maybeSingle();
    if (data?.slug) slug = data.slug;
  } catch {
    // fall through
  }
  redirect(`/donate/${slug}`);
}
