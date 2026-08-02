"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Calendar, Plus } from "lucide-react";
import { format } from "date-fns";
import { PageHeader, StatCard } from "@/components/shared/page-shell";
import { DataTable } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CampaignEvent } from "@/types/database";

export function EventsView({ events }: { events: CampaignEvent[] }) {
  const router = useRouter();
  const upcoming = events.filter((e) => new Date(e.starts_at) > new Date()).length;
  return (
    <div className="space-y-6">
      <PageHeader title="Campaign Events" description="Rallies, town halls, ward meetings and check-in">
        <div className="flex gap-2">
          <Button variant="outline" asChild><Link href="/events/calendar">Calendar</Link></Button>
          <Button asChild><Link href="/events/new"><Plus className="mr-2 h-4 w-4" />Create Event</Link></Button>
        </div>
      </PageHeader>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Total Events" value={events.length} icon={Calendar} />
        <StatCard title="Upcoming" value={upcoming} />
        <StatCard title="Past" value={events.length - upcoming} />
      </div>
      <DataTable
        data={events}
        searchKeys={["title", "location", "ward"]}
        onRowClick={(e) => router.push(`/events/${e.id}`)}
        columns={[
          { key: "title", header: "Title" },
          { key: "location", header: "Location" },
          { key: "starts_at", header: "Date", render: (e) => format(new Date(e.starts_at), "PP") },
          { key: "event_type", header: "Type", render: (e) => <Badge variant="secondary">{e.event_type.replace(/_/g, " ")}</Badge> },
        ]}
      />
    </div>
  );
}
