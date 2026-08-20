"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { PageHeader } from "@/components/shared/page-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  usePollingUnitStatusRealtime,
  useIncidentsRealtime,
  useElectionResultsRealtime,
  useAgentReportsRealtime,
} from "@/hooks/use-tenant-realtime";
import { parsePartyVotes, RESULT_PARTIES } from "@/lib/elections/parties";
import {
  OUR_PARTY,
  buildLiveFeed,
  buildRaceAnalysis,
  type ResultRow,
  type StatusRow,
} from "@/lib/situation-room/race";
import { LiveNumber, RaceBars, RaceCharts } from "@/components/situation-room/situation-room-charts";
import { formatDateTime } from "@/lib/utils";

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

type Incident = {
  id: string;
  title: string;
  severity: string;
  status: string;
  is_emergency: boolean;
  created_at: string;
};

type AgentReport = {
  id: string;
  report_type: string;
  content: string;
  created_at: string;
  profiles: { full_name: string } | null;
};

type Props = {
  tenantId: string;
  ourParty: string;
  universe: { puCount: number; registeredVoters: number };
  statuses: StatusRow[];
  incidents: Incident[];
  results: ResultRow[];
  agentReports: AgentReport[];
  wardTurnout: Array<{ ward: string; turnout: number; registered: number }>;
};

function upsert<T extends { id: string }>(list: T[], row: T, eventType?: string) {
  if (eventType === "DELETE") return list.filter((item) => item.id !== row.id);
  const i = list.findIndex((item) => item.id === row.id);
  if (i === -1) return [row, ...list];
  const next = [...list];
  next[i] = { ...next[i], ...row };
  return next;
}

function hasId(value: unknown): value is { id: string } {
  return Boolean(value && typeof value === "object" && "id" in value && typeof (value as { id: unknown }).id === "string");
}

export function SituationRoomView({
  tenantId,
  ourParty,
  universe,
  statuses: initialStatuses,
  incidents: initialIncidents,
  results: initialResults,
  agentReports: initialReports,
  wardTurnout,
}: Props) {
  const router = useRouter();
  const party = (ourParty || OUR_PARTY).toUpperCase();
  const [statuses, setStatuses] = useState(initialStatuses);
  const [incidents, setIncidents] = useState(initialIncidents);
  const [results, setResults] = useState(initialResults);
  const [agentReports, setAgentReports] = useState(initialReports);
  const [clock, setClock] = useState(() => new Date());
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setStatuses(initialStatuses), [initialStatuses]);
  useEffect(() => setIncidents(initialIncidents), [initialIncidents]);
  useEffect(() => setResults(initialResults), [initialResults]);
  useEffect(() => setAgentReports(initialReports), [initialReports]);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => router.refresh(), 900);
  }, [router]);

  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 1000);
    const poll = setInterval(() => router.refresh(), 20000);
    return () => {
      clearInterval(id);
      clearInterval(poll);
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
  }, [router]);

  const { connected: liveStatus } = usePollingUnitStatusRealtime(tenantId, (payload) => {
    if (hasId(payload?.new)) setStatuses((prev) => upsert(prev, payload!.new as StatusRow, payload?.eventType));
    scheduleRefresh();
  });
  const { connected: liveIncidents } = useIncidentsRealtime(tenantId, (payload) => {
    if (hasId(payload?.new)) setIncidents((prev) => upsert(prev, payload!.new as Incident, payload?.eventType));
    scheduleRefresh();
  });
  const { connected: liveResults } = useElectionResultsRealtime(tenantId, (payload) => {
    if (hasId(payload?.new)) setResults((prev) => upsert(prev, payload!.new as ResultRow, payload?.eventType));
    scheduleRefresh();
  });
  const { connected: liveReports } = useAgentReportsRealtime(tenantId, (payload) => {
    if (hasId(payload?.new)) setAgentReports((prev) => upsert(prev, payload!.new as AgentReport, payload?.eventType));
    scheduleRefresh();
  });

  const live = liveStatus || liveIncidents || liveResults || liveReports;
  const race = useMemo(
    () =>
      buildRaceAnalysis({
        ourParty: party,
        universePuCount: universe.puCount,
        universeRegistered: universe.registeredVoters,
        statuses,
        results,
      }),
    [party, universe.puCount, universe.registeredVoters, statuses, results]
  );
  const feed = useMemo(
    () => buildLiveFeed({ results, incidents, agentReports, statuses, ourParty: party }),
    [results, incidents, agentReports, statuses, party]
  );

  const leading = race.margin >= 0;
  const rivalName =
    Object.entries(race.countedVotes)
      .filter(([code]) => code !== party)
      .sort((a, b) => b[1] - a[1])[0]?.[0] ?? "PDP";

  const markers = statuses
    .filter((s) => s.polling_units?.latitude && s.polling_units?.longitude)
    .map((s) => ({
      id: s.id,
      lat: s.polling_units!.latitude!,
      lng: s.polling_units!.longitude!,
      label: s.polling_units!.name ?? "PU",
      sublabel: s.polling_units!.code,
      status: s.status,
    }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Election Situation Room"
        description="Live race desk — voter register, accredited turnout, and projected finish"
      >
        <div className="flex items-center gap-3">
          <span className="text-xs tabular-nums text-muted-foreground">
            {clock.toLocaleTimeString("en-NG")}
          </span>
          <Badge variant={live ? "default" : "secondary"} className="gap-2">
            <span className="relative flex h-2.5 w-2.5">
              {live && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              )}
              <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${live ? "bg-emerald-500" : "bg-muted-foreground"}`} />
            </span>
            {live ? "Live data" : "Connecting…"}
          </Badge>
        </div>
      </PageHeader>

      <div className="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/15 via-card to-card p-5 sm:p-6">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-emerald-400/10 blur-3xl" />
        <p className="text-xs font-medium uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
          {party} vs PDP · APC · ADC
        </p>
        {race.countedPuCount === 0 ? (
          <p className="mt-2 text-2xl font-bold">Waiting for the first result sheet</p>
        ) : (
          <p className="mt-2 text-2xl font-bold sm:text-3xl">
            {leading ? (
              <>
                {party} leading {rivalName} by <LiveNumber value={Math.abs(Math.round(race.margin))} /> votes
              </>
            ) : (
              <>
                {party} trails {rivalName} by <LiveNumber value={Math.abs(Math.round(race.margin))} /> votes
              </>
            )}
          </p>
        )}
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Projected finish: <span className="font-medium text-foreground">{race.projectedLeader}</span>
          {race.remainingBallots > 0
            ? ` · ${Math.round(race.remainingBallots).toLocaleString()} ballots still expected from unreported units at the observed ${(race.turnoutRate * 100).toFixed(1)}% turnout.`
            : " · All registered voters in the counted set are in."}{" "}
          Projection holds remaining PUs at the same party share as counted units.
          {universe.registeredVoters === 0
            ? " Register totals use reported units until the universe stats function is applied in the database."
            : ""}
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Kpi label="Voter register" value={race.universeRegistered} hint="All polling units" />
          <Kpi label="Accredited (turnout)" value={race.accredited} hint="From PU status reports" />
          <Kpi label="Votes counted" value={race.countedBallots} hint={`${race.countedPuCount} result sheets`} />
          <Kpi
            label="Reporting"
            valuePct={race.reportingPct}
            hint={`${(race.puReportingPct * 100).toFixed(1)}% of PUs`}
          />
          <Kpi label="Observed turnout" valuePct={race.turnoutRate} hint="Accredited / register" />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="pt-5">
            <h2 className="mb-4 font-semibold">Race board</h2>
            <RaceBars race={race} />
          </CardContent>
        </Card>
        <Card className="overflow-hidden">
          <CardContent className="pt-5">
            <h2 className="mb-3 font-semibold">Incoming</h2>
            <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
              <AnimatePresence initial={false}>
                {feed.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Result sheets, incidents, and field reports appear here as agents submit.
                  </p>
                ) : (
                  feed.map((item) => (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ opacity: 0, x: 24 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`rounded-md border px-3 py-2 text-sm ${
                        item.tone === "win"
                          ? "border-emerald-500/40 bg-emerald-500/10"
                          : item.tone === "alert"
                            ? "border-destructive/40 bg-destructive/10"
                            : "border-border bg-muted/40"
                      }`}
                    >
                      <p className="font-medium">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.detail}</p>
                      <p className="text-[11px] text-muted-foreground">Logged {formatDateTime(item.at)}</p>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>
          </CardContent>
        </Card>
      </div>

      <RaceCharts race={race} />

      {markers.length > 0 && <CampaignMap markers={markers} height={320} cluster={markers.length > 10} />}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="pt-4">
            <h2 className="mb-3 font-semibold">Turnout by ward</h2>
            {wardTurnout.length === 0 ? (
              <p className="text-sm text-muted-foreground">No turnout data yet.</p>
            ) : (
              wardTurnout.slice(0, 12).map((w) => (
                <div key={w.ward} className="mb-2 flex justify-between text-sm">
                  <span>{w.ward}</span>
                  <span>
                    {w.turnout.toLocaleString()} / {w.registered.toLocaleString()} (
                    {w.registered ? Math.round((w.turnout / w.registered) * 100) : 0}%)
                  </span>
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
              agentReports.slice(0, 8).map((r) => (
                <div key={r.id} className="mb-2 border-b border-border pb-2 text-sm last:border-0">
                  <span className="font-medium">{r.profiles?.full_name ?? "Agent"}</span> · {r.report_type}
                  <p className="text-muted-foreground">{r.content.slice(0, 80)}</p>
                  <p className="text-[11px] text-muted-foreground">Logged {formatDateTime(r.created_at)}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <h2 className="font-semibold">Polling unit status</h2>
          {statuses.length === 0 && (
            <p className="text-sm text-muted-foreground">Agents have not posted PU status yet.</p>
          )}
          {statuses.slice(0, 20).map((s) => (
            <Card key={s.id}>
              <CardContent className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium">{s.polling_units?.name ?? "Unknown"}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.polling_units?.ward}, {s.polling_units?.lga}
                  </p>
                  <p className="text-[11px] text-muted-foreground">Logged {formatDateTime(s.updated_at)}</p>
                </div>
                <div className="text-right">
                  <Badge variant={STATUS_VARIANT[s.status] ?? "secondary"}>{s.status.replace(/_/g, " ")}</Badge>
                  {s.turnout != null && s.turnout > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">{s.turnout.toLocaleString()} accredited</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="space-y-2">
          <h2 className="font-semibold">Incidents & latest sheets</h2>
          {incidents.map((i) => (
            <Card key={i.id}>
              <CardContent className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium">
                    {i.is_emergency ? "🚨 " : ""}
                    {i.title}
                  </p>
                  <p className="text-xs text-muted-foreground">Logged {formatDateTime(i.created_at)}</p>
                </div>
                <Badge variant={i.severity === "high" || i.severity === "critical" ? "destructive" : "secondary"}>
                  {i.severity}
                </Badge>
              </CardContent>
            </Card>
          ))}
          {results.slice(0, 12).map((r) => {
            const votes = parsePartyVotes(r.party_votes);
            const ordered = RESULT_PARTIES.map((p) => ({ code: p.code, n: votes[p.code] ?? 0 })).filter((p) => p.n > 0);
            const extras = Object.entries(votes)
              .filter(([code, n]) => n > 0 && !RESULT_PARTIES.some((p) => p.code === code))
              .map(([code, n]) => ({ code, n }));
            const breakdown = [...ordered, ...extras];
            return (
              <Card key={r.id}>
                <CardContent className="py-3 text-sm">
                  <span className="font-medium">{r.polling_units?.name ?? r.polling_units?.code ?? "PU"}</span> —{" "}
                  {r.total_votes.toLocaleString()} votes
                  {breakdown.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {breakdown.map((p) => `${p.code} ${p.n.toLocaleString()}`).join(" · ")}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">Logged {formatDateTime(r.submitted_at)}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  valuePct,
  hint,
}: {
  label: string;
  value?: number;
  valuePct?: number;
  hint: string;
}) {
  return (
    <div className="rounded-xl border border-border/80 bg-background/50 px-3 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold">
        {valuePct != null ? `${(valuePct * 100).toFixed(1)}%` : <LiveNumber value={Math.round(value ?? 0)} />}
      </p>
      <p className="text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}
