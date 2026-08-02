import Link from "next/link";
import { Calendar, Plus } from "lucide-react";
import { format } from "date-fns";
import { PageHeader, EmptyState, StatCard } from "@/components/shared/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { CampaignEvent } from "@/types/database";

export function EventsView({ events }: { events: CampaignEvent[] }) {
  const upcoming = events.filter((e) => new Date(e.starts_at) > new Date()).length;
  return (
    <div className="space-y-6">
      <PageHeader title="Campaign Events" description="Rallies, town halls, ward meetings and check-in">
        <Button asChild>
          <Link href="/events/new"><Plus className="mr-2 h-4 w-4" />Create Event</Link>
        </Button>
      </PageHeader>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Total Events" value={events.length} icon={Calendar} />
        <StatCard title="Upcoming" value={upcoming} />
        <StatCard title="Past" value={events.length - upcoming} />
      </div>
      {events.length === 0 ? (
        <EmptyState title="No events scheduled" description="Create your first campaign event with QR check-in." />
      ) : (
        <div className="grid gap-3">
          {events.map((e) => (
            <Card key={e.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div>
                  <p className="font-medium">{e.title}</p>
                  <p className="text-sm text-muted-foreground">{e.location}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(e.starts_at), "PPp")}
                    {e.ward ? ` · ${e.ward}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{e.event_type.replace(/_/g, " ")}</Badge>
                  {e.qr_code && <Badge variant="outline">QR ready</Badge>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
