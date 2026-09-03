"use client";

import { useEffect, useState } from "react";
import {
  Users, Heart, MapPin, Calendar, TrendingUp, DollarSign,
  MessageSquare, Bot, Clock, Activity, ThumbsUp, Share2,
} from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Legend,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { PageHeader, StatCard } from "@/components/shared/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils";
import type { DashboardData } from "@/lib/dashboard-data";

function Countdown({ label, targetDate }: { label: string; targetDate: string | null }) {
  const [remaining, setRemaining] = useState({ days: 0, hours: 0, minutes: 0 });

  useEffect(() => {
    if (!targetDate) return;
    const tick = () => {
      const diff = new Date(targetDate).getTime() - Date.now();
      if (diff <= 0) { setRemaining({ days: 0, hours: 0, minutes: 0 }); return; }
      setRemaining({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
      });
    };
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, [targetDate]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Clock className="h-4 w-4" /> {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {targetDate ? (
          <div className="flex gap-4">
            {[{ v: remaining.days, l: "Days" }, { v: remaining.hours, l: "Hrs" }, { v: remaining.minutes, l: "Min" }].map(({ v, l }) => (
              <div key={l} className="text-center">
                <p className="text-2xl font-bold tabular-nums">{v}</p>
                <p className="text-xs text-muted-foreground">{l}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Not set</p>
        )}
      </CardContent>
    </Card>
  );
}

function CampaignProgress({ startDate, endDate }: { startDate: string | null; endDate: string | null }) {
  const [pct, setPct] = useState(0);
  const [daysElapsed, setDaysElapsed] = useState(0);
  const [totalDays, setTotalDays] = useState(0);

  useEffect(() => {
    if (!startDate || !endDate) return;
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    const total = end - start;
    if (total <= 0) return;
    const elapsed = Date.now() - start;
    const p = Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
    setPct(p);
    setDaysElapsed(Math.max(0, Math.floor(elapsed / 86400000)));
    setTotalDays(Math.floor(total / 86400000));
  }, [startDate, endDate]);

  if (!startDate || !endDate) return null;

  return (
    <Card className="sm:col-span-2 lg:col-span-2">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Clock className="h-4 w-4" /> Campaign progress
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Day {daysElapsed} of {totalDays}</span>
          <span>{pct}% complete</span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{new Date(startDate).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}</span>
          <span>{new Date(endDate).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}</span>
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardView({ data }: { data: DashboardData }) {
  const { stats, briefing, activities, engagementTrend, issueBreakdown } = data;
  const fundraisingPct = stats.fundraisingGoal
    ? Math.min(100, Math.round((stats.donations / stats.fundraisingGoal) * 100))
    : 0;

  const sentimentData = briefing
    ? [
        { name: "Positive", value: briefing.sentimentBreakdown.positive },
        { name: "Neutral", value: briefing.sentimentBreakdown.neutral },
        { name: "Negative", value: briefing.sentimentBreakdown.negative },
      ]
    : [];

  return (
    <div className="space-y-6">
      <PageHeader title="Executive Dashboard" description={`${data.tenantName} — Live campaign intelligence`} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Countdown label="Election Countdown" targetDate={data.electionDate} />
        <Countdown label="Campaign End" targetDate={data.campaignEndDate} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <CampaignProgress startDate={data.campaignStartDate} endDate={data.campaignEndDate} />
        <StatCard title="Sentiment Score" value={`${stats.sentimentScore}%`} icon={TrendingUp} change="From live comments" />
        <StatCard title="Pending Comments" value={stats.pendingComments} icon={MessageSquare} change="Needs response" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        <StatCard title="Supporters" value={formatNumber(stats.supporters)} icon={Heart} />
        <StatCard title="Volunteers" value={formatNumber(stats.volunteers)} icon={Users} />
        <StatCard title="Polling Units" value={formatNumber(stats.pollingUnits)} icon={MapPin} />
        <StatCard title="Events" value={formatNumber(stats.events)} icon={Calendar} />
        <StatCard title="Followers" value={formatNumber(stats.socialEngagement)} icon={TrendingUp} />
        <StatCard title="FB Posts" value={formatNumber(stats.totalPosts)} icon={Activity} />
        <StatCard title="Total Likes" value={formatNumber(stats.totalLikes)} icon={ThumbsUp} />
        <StatCard title="Comments" value={formatNumber(stats.totalComments)} icon={MessageSquare} />
        <StatCard title="Shares" value={formatNumber(stats.totalShares)} icon={Share2} />
        <StatCard title="Donations" value={formatCurrency(stats.donations)} icon={DollarSign} change={`${fundraisingPct}% of goal`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Facebook Post Engagement</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {engagementTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={engagementTrend}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="label" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="likes" stackId="1" stroke="oklch(0.6 0.18 255)" fill="oklch(0.6 0.18 255 / 0.3)" />
                  <Area type="monotone" dataKey="comments" stackId="1" stroke="oklch(0.55 0.15 145)" fill="oklch(0.55 0.15 145 / 0.3)" />
                  <Area type="monotone" dataKey="shares" stackId="1" stroke="oklch(0.75 0.15 75)" fill="oklch(0.75 0.15 75 / 0.3)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Sync Facebook to see engagement data
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bot className="h-4 w-4" /> AI Daily Briefing
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {briefing && (
              <>
                <p className="text-muted-foreground">{briefing.summary}</p>
                <div className="flex flex-wrap gap-1">
                  {briefing.topIssues.map((issue) => (
                    <Badge key={issue} variant="secondary">{issue}</Badge>
                  ))}
                </div>
                <div className="flex gap-2 text-xs">
                  {sentimentData.map((s) => (
                    <span key={s.name} className="rounded bg-muted px-2 py-1">{s.name}: {s.value}%</span>
                  ))}
                </div>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {briefing.recommendations.slice(0, 4).map((rec) => (
                    <li key={rec}>• {rec}</li>
                  ))}
                </ul>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Top Issues (from comments)</CardTitle></CardHeader>
          <CardContent className="h-52">
            {issueBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={issueBreakdown} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" className="text-xs" />
                  <YAxis dataKey="topic" type="category" width={70} className="text-xs" />
                  <Tooltip />
                  <Bar dataKey="count" fill="oklch(0.6 0.18 255)" radius={4} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="flex h-full items-center justify-center text-sm text-muted-foreground">No issue data yet</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Recent Activity</CardTitle></CardHeader>
          <CardContent>
            {activities.length > 0 ? (
              <ul className="space-y-3">
                {activities.map((a) => (
                  <li key={a.id} className="flex items-start justify-between gap-2 text-sm">
                    <span>{a.description}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatDate(a.created_at)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No recent activity</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
