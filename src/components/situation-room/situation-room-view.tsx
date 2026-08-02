"use client";

import dynamic from "next/dynamic";
import { PageHeader, StatCard } from "@/components/shared/page-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const CampaignMap = dynamic(() => import("@/components/maps/campaign-map").then((m) => m.CampaignMap), {
  ssr: false,
  loading: () => <div className="h-80 animate-pulse rounded-xl bg-muted" />,
});

const STATUS_COLORS: Record<string, string> = {
  not_active: "secondary",
  voting_in_progress: "default",
  delayed: "outline",
  minor_issue: "outline",
  serious_incident: "destructive",
  results_uploaded: "default",
};

type StatusRow = {
  id: string;
  status: string;
  turnout: number | null;
  polling_units: { name: string; ward: string; lga: string; latitude: number | null; longitude: number | null } | null;
};

type Incident = {
  id: string;
  title: string;
  severity: string;
  status: string;
  is_emergency: boolean;
  created_at: string;
};

export function SituationRoomView({ statuses, incidents }: { statuses: StatusRow[]; incidents: Incident[] }) {
  const active = statuses.filter((s) => s.status === "voting_in_progress").length;
  const markers = statuses
    .filter((s) => s.polling_units?.latitude && s.polling_units?.longitude)
    .map((s) => ({
      id: s.id,
      lat: s.polling_units!.latitude!,
      lng: s.polling_units!.longitude!,
      label: s.polling_units!.name,
      sublabel: s.status.replace(/_/g, " "),
    }));

  return (
    <div className="space-y-6">
      <PageHeader title="Election Situation Room" description="Live polling unit status and incidents" />
      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard title="PU Status Tracked" value={statuses.length} />
        <StatCard title="Voting Active" value={active} />
        <StatCard title="Open Incidents" value={incidents.filter((i) => i.status === "open").length} />
        <StatCard title="Emergencies" value={incidents.filter((i) => i.is_emergency).length} />
      </div>
      {markers.length > 0 && <CampaignMap markers={markers} height={320} />}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <h2 className="font-semibold">Polling Unit Status</h2>
          {statuses.length === 0 ? (
            <p className="text-sm text-muted-foreground">No status updates yet. Agents can report from the Agent Portal.</p>
          ) : statuses.map((s) => (
            <Card key={s.id}>
              <CardContent className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium">{s.polling_units?.name ?? "Unknown PU"}</p>
                  <p className="text-xs text-muted-foreground">{s.polling_units?.ward}, {s.polling_units?.lga}</p>
                </div>
                <div className="text-right">
                  <Badge variant={(STATUS_COLORS[s.status] ?? "secondary") as "default" | "secondary" | "destructive" | "outline"}>
                    {s.status.replace(/_/g, " ")}
                  </Badge>
                  {s.turnout != null && <p className="mt-1 text-xs text-muted-foreground">{s.turnout} turnout</p>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="space-y-2">
          <h2 className="font-semibold">Recent Incidents</h2>
          {incidents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No incidents reported.</p>
          ) : incidents.map((i) => (
            <Card key={i.id}>
              <CardContent className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium">{i.is_emergency ? "🚨 " : ""}{i.title}</p>
                  <p className="text-xs text-muted-foreground">{new Date(i.created_at).toLocaleString()}</p>
                </div>
                <Badge variant={i.severity === "critical" || i.severity === "high" ? "destructive" : "secondary"}>{i.severity}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
