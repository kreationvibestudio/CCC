import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/paginate";

export type SentimentTotals = { positive: number; neutral: number; negative: number };
export type SentimentData = {
  sentiment: SentimentTotals;
  issueBreakdown: { topic: string; count: number }[];
  total: number;
  trend: { date: string; positive: number; neutral: number; negative: number }[];
  wardBreakdown: {
    ward: string;
    total: number;
    positive: number;
    neutral: number;
    negative: number;
  }[];
};

const TREND_DAYS = 14;
const WARD_LIMIT = 10;

const num = (value: unknown) => Number(value ?? 0) || 0;

/**
 * Rolled up by the database.
 *
 * This page used to fetch every comment row and count them here, which
 * PostgREST truncates at db-max-rows, so an inbox larger than 1000 reported a
 * prefix of itself as the whole picture on every chart.
 */
export async function getSentimentData(tenantId: string): Promise<SentimentData> {
  const supabase = await createClient();

  const rollup = await supabase.rpc("sentiment_rollup", {
    p_tenant_id: tenantId,
    p_trend_days: TREND_DAYS,
    p_wards: WARD_LIMIT,
  });

  if (!rollup.error && rollup.data && typeof rollup.data === "object") {
    const data = rollup.data as Record<string, unknown>;
    const sentiment = (data.sentiment ?? {}) as Record<string, unknown>;
    const rows = <T,>(value: unknown) => (Array.isArray(value) ? (value as T[]) : []);

    return {
      total: num(data.total),
      sentiment: {
        positive: num(sentiment.positive),
        neutral: num(sentiment.neutral),
        negative: num(sentiment.negative),
      },
      issueBreakdown: rows<{ topic?: string; count?: number }>(data.issues).map((row) => ({
        topic: String(row.topic ?? "other").replace(/_/g, " "),
        count: num(row.count),
      })),
      trend: rows<Record<string, unknown>>(data.trend).map((row) => ({
        date: String(row.date ?? "unknown"),
        positive: num(row.positive),
        neutral: num(row.neutral),
        negative: num(row.negative),
      })),
      wardBreakdown: rows<Record<string, unknown>>(data.wards).map((row) => ({
        ward: String(row.ward ?? "Unknown"),
        total: num(row.total),
        positive: num(row.positive),
        neutral: num(row.neutral),
        negative: num(row.negative),
      })),
    };
  }

  return legacySentimentData(supabase, tenantId);
}

/**
 * Used only until the rollup migration is applied. Pages through the rows so a
 * pre-migration deploy is merely slow rather than wrong.
 */
async function legacySentimentData(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string
): Promise<SentimentData> {
  const comments = await fetchAllRows<{
    sentiment: string | null;
    issue_topic: string | null;
    created_at: string | null;
    ward: string | null;
  }>(
    (from, to) =>
      supabase
        .from("comments")
        .select("sentiment, issue_topic, created_at, ward")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .range(from, to),
    { max: 50_000 }
  );

  const sentiment: SentimentTotals = { positive: 0, neutral: 0, negative: 0 };
  const issueMap = new Map<string, number>();
  const byDay = new Map<string, SentimentTotals>();
  const byWard = new Map<string, SentimentTotals>();

  for (const c of comments) {
    if (c.sentiment && c.sentiment in sentiment) {
      sentiment[c.sentiment as keyof SentimentTotals]++;
    }
    if (c.issue_topic) issueMap.set(c.issue_topic, (issueMap.get(c.issue_topic) ?? 0) + 1);

    const day = c.created_at?.slice(0, 10) ?? "unknown";
    const dayRow = byDay.get(day) ?? { positive: 0, negative: 0, neutral: 0 };
    if (c.sentiment === "positive") dayRow.positive++;
    else if (c.sentiment === "negative") dayRow.negative++;
    else dayRow.neutral++;
    byDay.set(day, dayRow);

    const ward = c.ward?.trim() || "Unknown";
    const wardRow = byWard.get(ward) ?? { positive: 0, negative: 0, neutral: 0 };
    if (c.sentiment === "positive") wardRow.positive++;
    else if (c.sentiment === "negative") wardRow.negative++;
    else wardRow.neutral++;
    byWard.set(ward, wardRow);
  }

  return {
    sentiment,
    total: comments.length,
    issueBreakdown: [...issueMap.entries()]
      .map(([topic, count]) => ({ topic: topic.replace(/_/g, " "), count }))
      .sort((a, b) => b.count - a.count),
    trend: [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-TREND_DAYS)
      .map(([date, v]) => ({ date, ...v })),
    wardBreakdown: [...byWard.entries()]
      .map(([ward, v]) => ({ ward, total: v.positive + v.neutral + v.negative, ...v }))
      .sort((a, b) => b.total - a.total)
      .slice(0, WARD_LIMIT),
  };
}
