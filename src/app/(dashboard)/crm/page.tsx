import { getContacts } from "@/lib/crm/actions";
import { CrmView } from "@/components/crm/crm-view";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/types/auth";

export default async function CrmPage() {
  const user = await getCurrentUser();
  const contacts = await getContacts();
  const canSeeDonations = user ? hasPermission(user.role, "donations.view") : false;
  const rows = canSeeDonations
    ? contacts
    : contacts.map((contact) => ({ ...contact, total_donations: 0 }));
  return <CrmView contacts={rows} />;
}
