import { getEvents } from "@/lib/events/actions";
import { EventsView } from "@/components/events/events-view";

export default async function EventsPage() {
  const events = await getEvents();
  return <EventsView events={events} />;
}
