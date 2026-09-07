import { getContacts } from "@/lib/crm/actions";
import { CrmView } from "@/components/crm/crm-view";

export default async function CrmPage() {
  const contacts = await getContacts();
  return <CrmView contacts={contacts} />;
}
