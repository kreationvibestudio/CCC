"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Plus } from "lucide-react";
import { format } from "date-fns";
import { PageHeader, StatCard } from "@/components/shared/page-shell";
import { DataTable } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CampaignEvent } from "@/types/database";
import { usePermissions } from "@/components/providers/auth-provider";

export function EventsView({ events }: { events: CampaignEvent[] }) {
  const router = useRouter();
  const { canCreate, can } = usePermissions();
  const canManageEvents = canCreate && can("events.manage");

  useEffect(() => {
    if (canManageEvents) router.prefetch("/events/new");
  }, [canManageEvents, router]);

  const now = Date.now();
  const sorted = [...events].sort(
    (a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime()
  );
  const upcoming = events.filter((e) => new Date(e.starts_at).getTime() >= now).length;
  return (
    <div className="space-y-6">
      <PageHeader title="Campaign Events" description="Schedule and manage rallies, town halls, and ward meetings">
        <div className="flex gap-2">
          <Button variant="outline" asChild><Link href="/events/calendar">Calendar</Link></Button>
          {canManageEvents ? (
          <Button asChild>
            <Link href="/events/new">
              <Plus className="mr-2 h-4 w-4" />
              Create Event
            </Link>
          </Button>
          ) : null}
        </div>
      </PageHeader>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Total Events" value={events.length} icon={Calendar} />
        <StatCard title="Upcoming" value={upcoming} />
        <StatCard title="Past" value={events.length - upcoming} />
      </div>
      <DataTable
        data={sorted}
        searchKeys={["title", "location", "ward"]}
        onRowClick={(e) => router.push(`/events/${e.id}`)}
        columns={[
          { key: "title", header: "Title" },
          { key: "location", header: "Location" },
          {
            key: "starts_at",
            header: "Date",
            render: (e) => {
              const at = new Date(e.starts_at);
              const label = Number.isNaN(at.getTime()) ? "—" : format(at, "PP");
              const isUpcoming = !Number.isNaN(at.getTime()) && at.getTime() >= now;
              return (
                <span className="inline-flex items-center gap-2">
                  {label}
                  {isUpcoming ? <Badge>Upcoming</Badge> : null}
                </span>
              );
            },
          },
          { key: "event_type", header: "Type", render: (e) => <Badge variant="secondary">{e.event_type.replace(/_/g, " ")}</Badge> },
        ]}
      />
    </div>
  );
}
