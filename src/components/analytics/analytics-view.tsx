"use client";

import Link from "next/link";
import {
  AlertTriangle,
  CalendarClock,
  MessageSquareWarning,
  ShieldAlert,
  Target,
  Users,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from "recharts";
import { PageHeader, StatCard } from "@/components/shared/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AnalyticsSummary } from "@/lib/analytics/data";
import type { CallSeverity } from "@/lib/analytics/decisions";
import { cn } from "@/lib/utils";

const SEVERITY_STYLES: Record<CallSeverity, string> = {
  critical: "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300",
  high: "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200",
  watch: "border-border bg-muted/60 text-muted-foreground",
};

function severityLabel(s: CallSeverity) {
  if (s === "critical") return "Critical";
  if (s === "high") return "Make the call";
  return "Watch";
}

export function AnalyticsView({ summary }: { summary: AnalyticsSummary }) {
  const { kpis, groundGame } = summary;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Election Decision Analytics"
        description="Signals for preventive and accurate calls — where to act before election day"
      >
        {summary.daysToElection != null ? (
          <p className="rounded-md border border-border bg-card px-3 py-2 text-sm">
            <CalendarClock className="mr-1.5 inline h-4 w-4" />
            <span className="font-medium">{summary.daysToElection}</span> days to election
            {summary.daysToCampaignEnd != null ? (
              <span className="text-muted-foreground"> · {summary.daysToCampaignEnd} to campaign end</span>
            ) : null}
          </p>
        ) : null}
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Sentiment score"
          value={`${kpis.sentimentScore}%`}
          change="Positive share of classified comments"
          icon={Target}
          href="/sentiment"
        />
        <StatCard
          title="Pending replies"
          value={kpis.pendingComments}
          change="Comment backlog still open"
          icon={MessageSquareWarning}
          href="/comments?status=pending"
        />
        <StatCard
          title="Misinfo open"
          value={kpis.misinfoOpen}
          change="Needs rapid response"
          icon={ShieldAlert}
          href="/comments?status=flagged"
        />
        <StatCard
          title="PU agent coverage"
          value={`${kpis.agentCoveragePct}%`}
          change={
            kpis.uncoveredHighRiskPus
              ? `${kpis.uncoveredHighRiskPus} high-risk PU(s) uncovered`
              : "High-risk units covered"
          }
          icon={Users}
          href="/polling-units/agents"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Volunteers trained"
          value={`${kpis.volunteersTrainedPct}%`}
          change={`${groundGame.volunteersTrained}/${groundGame.volunteersTotal} ready`}
          href="/volunteers"
        />
        <StatCard
          title="Undecided contacts"
          value={kpis.undecidedContacts}
          change={`${kpis.strongSupporters} leaning/strong supporters`}
          href="/crm"
        />
        <StatCard
          title="Upcoming events"
          value={kpis.upcomingEvents}
          change={`${summary.events} total on calendar`}
          href="/events"
        />
        <StatCard
          title="Field incidents"
          value={summary.incidents}
          change="Situation Room reports"
          href="/situation-room"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Calls to make now
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Ranked by urgency from live comment, coverage, and ground-game signals.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {summary.calls.map((call) => (
            <Link
              key={call.id}
              href={call.href}
              className={cn(
                "block rounded-lg border px-4 py-3 transition-colors hover:border-primary/40",
                SEVERITY_STYLES[call.severity]
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide">
                  {severityLabel(call.severity)}
                </span>
                <h3 className="text-sm font-semibold text-foreground">{call.title}</h3>
              </div>
              <p className="mt-1 text-sm text-foreground/90">{call.reason}</p>
              <p className="mt-1 text-xs font-medium text-foreground/70">{call.action}</p>
            </Link>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Hot issues (pressure)</CardTitle>
            <p className="text-sm text-muted-foreground">
              Topics weighted by volume and negativity — brief messaging here first.
            </p>
          </CardHeader>
          <CardContent className="h-72">
            {summary.hotIssues.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={summary.hotIssues.map((i) => ({
                    topic: i.topic,
                    negative: i.negative,
                    other: Math.max(0, i.total - i.negative),
                  }))}
                  layout="vertical"
                >
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="topic" width={100} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="negative" name="Negative" stackId="a" fill="#ef4444" radius={2} />
                  <Bar dataKey="other" name="Other" stackId="a" fill="hsl(var(--primary))" radius={2} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground">Classify comments to surface issue pressure.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Coverage gaps to close</CardTitle>
            <p className="text-sm text-muted-foreground">
              Unassigned polling units with the largest voter registers.
            </p>
          </CardHeader>
          <CardContent>
            {summary.coverageGaps.length ? (
              <ul className="max-h-72 space-y-2 overflow-y-auto text-sm">
                {summary.coverageGaps.map((pu) => (
                  <li
                    key={pu.code}
                    className="flex items-start justify-between gap-3 border-b border-border/60 pb-2 last:border-0"
                  >
                    <div>
                      <p className="font-medium">
                        {pu.code} · {pu.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {pu.ward}, {pu.lga} · risk {pu.risk_level || "n/a"}
                      </p>
                    </div>
                    <p className="shrink-0 tabular-nums text-muted-foreground">
                      {Number(pu.registered_voters ?? 0).toLocaleString()} voters
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">All listed PUs have agents assigned — or no PU data yet.</p>
            )}
            <Link href="/polling-units/agents" className="mt-3 inline-block text-sm font-medium text-primary hover:underline">
              Assign agents →
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Sentiment trajectory (14 days)</CardTitle>
            <p className="text-sm text-muted-foreground">Spot slides early — act before narratives harden.</p>
          </CardHeader>
          <CardContent className="h-64">
            {summary.sentimentTrend.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={summary.sentimentTrend}>
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="positive" stroke="#22c55e" strokeWidth={2} />
                  <Line type="monotone" dataKey="negative" stroke="#ef4444" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground">No dated sentiment yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Wards under pressure</CardTitle>
            <p className="text-sm text-muted-foreground">Highest negative share — prioritize visits and local reply.</p>
          </CardHeader>
          <CardContent className="h-64">
            {summary.pressureWards.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={summary.pressureWards}>
                  <XAxis dataKey="ward" tick={{ fontSize: 10 }} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="negativePct" name="% negative" fill="#ef4444" radius={4} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground">Need ward-tagged comments to map pressure.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Ground game readiness</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[
                  { name: "Volunteers trained", count: groundGame.volunteersTrained },
                  { name: "Volunteers pending", count: groundGame.volunteersPending },
                  { name: "PUs with agents", count: groundGame.agentsAssignedPus },
                  { name: "PUs uncovered", count: Math.max(0, groundGame.pusTotal - groundGame.agentsAssignedPus) },
                  { name: "Supporters", count: groundGame.supporters },
                  { name: "Undecided", count: groundGame.undecided },
                ]}
              >
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={60} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={4} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {summary.geographic.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Largest voter registers by ward</CardTitle>
              <p className="text-sm text-muted-foreground">Where turnout operations move the most votes.</p>
            </CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={summary.geographic} layout="vertical">
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="ward" width={100} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="voters" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Module scale</CardTitle>
            </CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[
                    { name: "Volunteers", count: summary.volunteers },
                    { name: "Contacts", count: summary.contacts },
                    { name: "Events", count: summary.events },
                    { name: "Comments", count: summary.comments },
                    { name: "PUs", count: summary.pollingUnits },
                    { name: "Incidents", count: summary.incidents },
                  ]}
                >
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={4} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {summary.donationTrend.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Donation capacity (monthly)</CardTitle>
            <p className="text-sm text-muted-foreground">
              Funding runway for airtime, logistics, and rapid response — not a vanity chart.
            </p>
          </CardHeader>
          <CardContent className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={summary.donationTrend}>
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="amount" stroke="hsl(var(--primary))" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="space-y-3 pt-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-semibold">Campaign read</h2>
            <p className="text-xs text-muted-foreground">
              Social engagement total: {summary.socialEngagement.toLocaleString()}
            </p>
          </div>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{summary.aiInsight}</p>
          {summary.recommendations.length ? (
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {summary.recommendations.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
