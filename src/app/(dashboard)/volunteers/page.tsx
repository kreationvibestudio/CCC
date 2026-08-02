import { getCurrentUser } from "@/lib/auth/session";
import { getVolunteers } from "@/lib/volunteers/actions";
import { VolunteersView } from "@/components/volunteers/volunteers-view";

export default async function VolunteersPage() {
  const user = await getCurrentUser();
  const volunteers = await getVolunteers(user!.profile.tenant_id);
  return <VolunteersView volunteers={volunteers} />;
}
