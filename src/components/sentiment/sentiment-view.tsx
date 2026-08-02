"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { PageHeader, StatCard } from "@/components/shared/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const COLORS = ["#22c55e", "#94a3b8", "#ef4444"];

type SentimentData = { positive: number; neutral: number; negative: number };

export function SentimentView({
  sentiment,
  issueBreakdown,
  total,
}: {
  sentiment: SentimentData;
  issueBreakdown: { topic: string; count: number }[];
  total: number;
}) {
  const pieData = [
    { name: "Positive", value: sentiment.positive },
    { name: "Neutral", value: sentiment.neutral },
    { name: "Negative", value: sentiment.negative },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Sentiment Analysis" description="Social comment sentiment and issue trends" />
      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard title="Classified Comments" value={total} />
        <StatCard title="Positive" value={sentiment.positive} />
        <StatCard title="Neutral" value={sentiment.neutral} />
        <StatCard title="Negative" value={sentiment.negative} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Sentiment Distribution</CardTitle></CardHeader>
          <CardContent className="h-64">
            {pieData.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sync Facebook comments and run AI classify.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Top Issues</CardTitle></CardHeader>
          <CardContent className="h-64">
            {issueBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground">No issue tags yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={issueBreakdown.slice(0, 8)} layout="vertical">
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="topic" width={90} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={4} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
