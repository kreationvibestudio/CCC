import { getCurrentUser } from "@/lib/auth/session";
import { getContacts } from "@/lib/crm/actions";
import { CrmView } from "@/components/crm/crm-view";

export default async function CrmPage() {
  const user = await getCurrentUser();
  const contacts = await getContacts(user!.profile.tenant_id);
  return <CrmView contacts={contacts} />;
}
