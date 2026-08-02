"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
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
        {chartData.map((d) => (
          <StatCard key={d.name} title={d.name} value={d.count} />
        ))}
      </div>
      <Card>
        <CardHeader><CardTitle>Module Overview</CardTitle></CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={4} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
