import { getCurrentUser } from "@/lib/auth/session";
import { getVolunteers } from "@/lib/volunteers/actions";
import { VolunteersView } from "@/components/volunteers/volunteers-view";
import { appBaseUrl } from "@/lib/campaign";

export default async function VolunteersPage() {
  const user = await getCurrentUser();
  const volunteers = await getVolunteers(user!.profile.tenant_id);
  const base =
    appBaseUrl() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL.replace(/\/$/, "")}` : "");
  const signupUrl =
    base && user?.workspace?.slug ? `${base}/volunteer/${user.workspace.slug}` : "";
  return <VolunteersView volunteers={volunteers} signupUrl={signupUrl} />;
}
