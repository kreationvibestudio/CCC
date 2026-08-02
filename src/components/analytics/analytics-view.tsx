"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { PageHeader, StatCard } from "@/components/shared/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Summary = {
  volunteers: number;
  contacts: number;
  events: number;
  comments: number;
  pollingUnits: number;
  incidents: number;
  sentiment: { positive: number; neutral: number; negative: number };
  donationTrend: { month: string; amount: number }[];
  geographic: { ward: string; voters: number }[];
  socialEngagement: number;
  aiInsight: string;
};

export function AnalyticsView({ summary }: { summary: Summary }) {
  const chartData = [
    { name: "Volunteers", count: summary.volunteers },
    { name: "Contacts", count: summary.contacts },
    { name: "Events", count: summary.events },
    { name: "Comments", count: summary.comments },
    { name: "Polling Units", count: summary.pollingUnits },
    { name: "Incidents", count: summary.incidents },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" description="Cross-module campaign performance" />
      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {chartData.map((d) => <StatCard key={d.name} title={d.name} value={d.count} />)}
      </div>
      <StatCard title="Social engagement (total)" value={summary.socialEngagement.toLocaleString()} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Module overview</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis /><Tooltip /><Bar dataKey="count" fill="hsl(var(--primary))" radius={4} /></BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        {summary.donationTrend.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Donation trend</CardTitle></CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={summary.donationTrend}><XAxis dataKey="month" /><YAxis /><Tooltip /><Line type="monotone" dataKey="amount" stroke="hsl(var(--primary))" /></LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>
      {summary.geographic.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Registered voters by ward</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={summary.geographic} layout="vertical"><XAxis type="number" /><YAxis type="category" dataKey="ward" width={100} tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="voters" fill="hsl(var(--primary))" /></BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
      <Card><CardContent className="pt-6"><h2 className="mb-2 font-semibold">AI insight</h2><p className="text-sm text-muted-foreground whitespace-pre-wrap">{summary.aiInsight}</p></CardContent></Card>
    </div>
  );
}
