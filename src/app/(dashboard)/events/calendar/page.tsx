import { getEvents } from "@/lib/events/actions";
import { Card, CardContent } from "@/components/ui/card";
import { format } from "date-fns";
import Link from "next/link";

export default async function EventsCalendarPage() {
  const events = await getEvents();
  const byMonth = new Map<string, typeof events>();
  for (const e of events) {
    const key = format(new Date(e.starts_at), "MMMM yyyy");
    if (!byMonth.has(key)) byMonth.set(key, []);
    byMonth.get(key)!.push(e);
  }
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Event Calendar</h1>
      {[...byMonth.entries()].map(([month, evs]) => (
        <div key={month}>
          <h2 className="mb-2 font-semibold">{month}</h2>
          <div className="grid gap-2">
            {evs.map((e) => (
              <Link key={e.id} href={`/events/${e.id}`}>
                <Card><CardContent className="py-3 text-sm">
                  <span className="font-medium">{e.title}</span> — {format(new Date(e.starts_at), "PPp")} · {e.location}
                </CardContent></Card>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
