import { getCurrentUser } from "@/lib/auth/session";
import { getEvents } from "@/lib/events/actions";
import { EventsView } from "@/components/events/events-view";

export default async function EventsPage() {
  const user = await getCurrentUser();
  const events = await getEvents(user!.profile.tenant_id);
  return <EventsView events={events} />;
}
