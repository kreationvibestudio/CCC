import Link from "next/link";
import { format, isValid } from "date-fns";
import { Plus } from "lucide-react";
import { getEvents } from "@/lib/events/actions";
import { PageHeader } from "@/components/shared/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getCurrentUser } from "@/lib/auth/session";
import { canWriteRecords } from "@/types/auth";
import { labelForEventType } from "@/lib/events/event-types";

function eventDate(value: string) {
  const d = new Date(value);
  return isValid(d) ? d : null;
}

export default async function EventsCalendarPage() {
  const [events, user] = await Promise.all([getEvents(), getCurrentUser()]);
  const canWrite = user ? canWriteRecords(user.role) : false;
  const now = Date.now();

  const dated = events
    .map((e) => ({ event: e, at: eventDate(e.starts_at) }))
    .filter((row): row is { event: (typeof events)[number]; at: Date } => row.at != null)
    .sort((a, b) => a.at.getTime() - b.at.getTime());

  const upcoming = dated.filter((row) => row.at.getTime() >= now);
  const past = dated.filter((row) => row.at.getTime() < now).reverse();

  const byMonth = new Map<string, typeof dated>();
  for (const row of upcoming.length ? upcoming : dated) {
    const key = format(row.at, "MMMM yyyy");
    if (!byMonth.has(key)) byMonth.set(key, []);
    byMonth.get(key)!.push(row);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Event Calendar" description="Upcoming rallies, town halls, and ward meetings">
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/events">All events</Link>
          </Button>
          {canWrite ? (
            <Button asChild>
              <Link href="/events/new">
                <Plus className="mr-2 h-4 w-4" />
                Schedule event
              </Link>
            </Button>
          ) : null}
        </div>
      </PageHeader>

      {dated.length === 0 ? (
        <Card>
          <CardContent className="space-y-3 py-10 text-center">
            <p className="font-medium">No events scheduled yet</p>
            <p className="text-sm text-muted-foreground">
              Create an upcoming town hall, rally, or ward meeting to fill the calendar.
            </p>
            {canWrite ? (
              <Button asChild>
                <Link href="/events/new">Create event</Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <>
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Upcoming</h2>
              <Badge variant="secondary">{upcoming.length}</Badge>
            </div>
            {upcoming.length === 0 ? (
              <Card>
                <CardContent className="space-y-3 py-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    Nothing upcoming. Schedule the next campaign event.
                  </p>
                  {canWrite ? (
                    <Button asChild size="sm">
                      <Link href="/events/new">Schedule event</Link>
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            ) : (
              [...byMonth.entries()].map(([month, rows]) => (
                <div key={month} className="space-y-2">
                  <h3 className="font-medium text-muted-foreground">{month}</h3>
                  <div className="grid gap-2">
                    {rows.map(({ event: e, at }) => (
                      <Link key={e.id} href={`/events/${e.id}`}>
                        <Card className="transition-colors hover:bg-muted/40">
                          <CardContent className="flex flex-col gap-1 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <span className="font-medium">{e.title}</span>
                              <span className="text-muted-foreground"> · {e.location}</span>
                            </div>
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Badge variant="outline">{labelForEventType(e.event_type)}</Badge>
                              <span>{format(at, "PPp")}</span>
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    ))}
                  </div>
                </div>
              ))
            )}
          </section>

          {past.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">Past</h2>
              <div className="grid gap-2">
                {past.slice(0, 20).map(({ event: e, at }) => (
                  <Link key={e.id} href={`/events/${e.id}`}>
                    <Card>
                      <CardContent className="py-3 text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">{e.title}</span>
                        {" — "}
                        {format(at, "PP")} · {e.location}
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
