"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from "recharts";
import { PageHeader, StatCard } from "@/components/shared/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCommentsRealtime } from "@/hooks/use-tenant-realtime";

const COLORS = ["#22c55e", "#94a3b8", "#ef4444"];

type Props = {
  tenantId: string;
  sentiment: { positive: number; neutral: number; negative: number };
  issueBreakdown: { topic: string; count: number }[];
  total: number;
  trend: { date: string; positive: number; neutral: number; negative: number }[];
  wardBreakdown: { ward: string; total: number; positive: number; negative: number }[];
};

export function SentimentView({ tenantId, sentiment, issueBreakdown, total, trend, wardBreakdown }: Props) {
  const router = useRouter();
  const refresh = useCallback(() => router.refresh(), [router]);
  useCommentsRealtime(tenantId, refresh);

  const pieData = [
    { name: "Positive", value: sentiment.positive },
    { name: "Neutral", value: sentiment.neutral },
    { name: "Negative", value: sentiment.negative },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Sentiment Analysis" description="Social comment sentiment, trends and ward breakdown" />
      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard title="Classified" value={total} />
        <StatCard title="Positive" value={sentiment.positive} />
        <StatCard title="Neutral" value={sentiment.neutral} />
        <StatCard title="Negative" value={sentiment.negative} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Sentiment distribution</CardTitle></CardHeader>
          <CardContent className="h-64">
            {pieData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart><Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie><Tooltip /></PieChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-muted-foreground">Sync and classify comments first.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Top issues</CardTitle></CardHeader>
          <CardContent className="h-64">
            {issueBreakdown.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={issueBreakdown.slice(0, 8)} layout="vertical">
                  <XAxis type="number" /><YAxis type="category" dataKey="topic" width={90} tick={{ fontSize: 11 }} /><Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={4} />
                </BarChart>
              </ResponsiveContainer>
            ) : null}
          </CardContent>
        </Card>
      </div>
      {trend.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Sentiment trend (14 days)</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend}>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} /><YAxis /><Tooltip /><Legend />
                <Line type="monotone" dataKey="positive" stroke="#22c55e" strokeWidth={2} />
                <Line type="monotone" dataKey="negative" stroke="#ef4444" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
      {wardBreakdown.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Ward breakdown</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={wardBreakdown}>
                <XAxis dataKey="ward" tick={{ fontSize: 10 }} /><YAxis /><Tooltip />
                <Bar dataKey="positive" stackId="a" fill="#22c55e" />
                <Bar dataKey="negative" stackId="a" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
