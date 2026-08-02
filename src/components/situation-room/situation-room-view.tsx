"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { PageHeader, StatCard } from "@/components/shared/page-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { usePollingUnitStatusRealtime, useIncidentsRealtime } from "@/hooks/use-tenant-realtime";

const CampaignMap = dynamic(() => import("@/components/maps/campaign-map").then((m) => m.CampaignMap), {
  ssr: false,
  loading: () => <div className="h-72 animate-pulse rounded-xl bg-muted" />,
});

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  voting_in_progress: "default",
  delayed: "outline",
  minor_issue: "outline",
  serious_incident: "destructive",
  results_uploaded: "default",
  not_active: "secondary",
};

type Props = {
  tenantId: string;
  statuses: Array<{
    id: string;
    status: string;
    turnout: number | null;
    polling_units: { name: string; ward: string; lga: string; latitude: number | null; longitude: number | null; code?: string } | null;
  }>;
  incidents: Array<{ id: string; title: string; severity: string; status: string; is_emergency: boolean; created_at: string }>;
  results: Array<{ id: string; total_votes: number; submitted_at: string; polling_units: { name: string; code: string } | null }>;
  agentReports: Array<{ id: string; report_type: string; content: string; created_at: string; profiles: { full_name: string } | null }>;
  wardTurnout: Array<{ ward: string; turnout: number; registered: number }>;
};

export function SituationRoomView({ tenantId, statuses, incidents, results, agentReports, wardTurnout }: Props) {
  const router = useRouter();
  const refresh = useCallback(() => router.refresh(), [router]);
  const { connected: liveStatus } = usePollingUnitStatusRealtime(tenantId, refresh);
  const { connected: liveIncidents } = useIncidentsRealtime(tenantId, refresh);

  const active = statuses.filter((s) => s.status === "voting_in_progress").length;
  const markers = statuses
    .filter((s) => s.polling_units?.latitude && s.polling_units?.longitude)
    .map((s) => ({
      id: s.id,
      lat: s.polling_units!.latitude!,
      lng: s.polling_units!.longitude!,
      label: s.polling_units!.name,
      sublabel: s.polling_units!.code,
      status: s.status,
    }));

  return (
    <div className="space-y-6">
      <PageHeader title="Election Situation Room" description="Live polling unit monitoring">
        <Badge variant={liveStatus || liveIncidents ? "default" : "secondary"}>
          {liveStatus || liveIncidents ? "Live" : "Connecting…"}
        </Badge>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard title="PU Status Tracked" value={statuses.length} />
        <StatCard title="Voting Active" value={active} />
        <StatCard title="Open Incidents" value={incidents.filter((i) => i.status === "open").length} />
        <StatCard title="Results In" value={results.length} />
      </div>

      {markers.length > 0 && <CampaignMap markers={markers} height={320} cluster={markers.length > 10} />}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="pt-4">
            <h2 className="mb-3 font-semibold">Turnout by ward</h2>
            {wardTurnout.length === 0 ? (
              <p className="text-sm text-muted-foreground">No turnout data yet.</p>
            ) : (
              wardTurnout.map((w) => (
                <div key={w.ward} className="mb-2 flex justify-between text-sm">
                  <span>{w.ward}</span>
                  <span>{w.turnout} / {w.registered} ({w.registered ? Math.round((w.turnout / w.registered) * 100) : 0}%)</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <h2 className="mb-3 font-semibold">Agent reports</h2>
            {agentReports.length === 0 ? (
              <p className="text-sm text-muted-foreground">No agent reports yet.</p>
            ) : (
              agentReports.slice(0, 6).map((r) => (
                <div key={r.id} className="mb-2 border-b border-border pb-2 text-sm last:border-0">
                  <span className="font-medium">{r.profiles?.full_name ?? "Agent"}</span> · {r.report_type}
                  <p className="text-muted-foreground">{r.content.slice(0, 80)}…</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <h2 className="font-semibold">Polling unit status</h2>
          {statuses.map((s) => (
            <Card key={s.id}>
              <CardContent className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium">{s.polling_units?.name ?? "Unknown"}</p>
                  <p className="text-xs text-muted-foreground">{s.polling_units?.ward}, {s.polling_units?.lga}</p>
                </div>
                <div className="text-right">
                  <Badge variant={STATUS_VARIANT[s.status] ?? "secondary"}>{s.status.replace(/_/g, " ")}</Badge>
                  {s.turnout != null && s.turnout > 0 && <p className="mt-1 text-xs text-muted-foreground">{s.turnout} turnout</p>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="space-y-2">
          <h2 className="font-semibold">Incidents & results</h2>
          {incidents.map((i) => (
            <Card key={i.id}>
              <CardContent className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium">{i.is_emergency ? "🚨 " : ""}{i.title}</p>
                  <p className="text-xs text-muted-foreground">{new Date(i.created_at).toLocaleString()}</p>
                </div>
                <Badge variant={i.severity === "high" || i.severity === "critical" ? "destructive" : "secondary"}>{i.severity}</Badge>
              </CardContent>
            </Card>
          ))}
          {results.map((r) => (
            <Card key={r.id}>
              <CardContent className="py-3 text-sm">
                <span className="font-medium">{r.polling_units?.name ?? "PU"}</span> — {r.total_votes} votes
                <p className="text-xs text-muted-foreground">{new Date(r.submitted_at).toLocaleString()}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
