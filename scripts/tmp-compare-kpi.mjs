// Temporary: old JS-reduce path (PostgREST-truncated) vs the new SQL aggregate.
import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal } from "./load-env.mjs";
loadEnvLocal();
const TENANT = "a0000000-0000-0000-0000-000000000001";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// --- what the dashboard used to do ---
const { data: donRows } = await admin.from("donations").select("amount").eq("tenant_id", TENANT);
const { data: cmtRows } = await admin.from("comments").select("id, sentiment, status, issue_topic, is_misinformation, content").eq("tenant_id", TENANT);
const { data: postRows } = await admin.from("social_posts").select("likes, shares, comments_count, posted_at").eq("tenant_id", TENANT).order("posted_at", { ascending: false }).limit(10);

const old = {
  donations: (donRows ?? []).reduce((s, d) => s + Number(d.amount), 0),
  donationRowsSeen: donRows?.length ?? 0,
  comments: cmtRows?.length ?? 0,
  pendingComments: (cmtRows ?? []).filter((c) => c.status === "pending").length,
  sentimentScore: cmtRows?.length ? Math.round(((cmtRows.filter((c) => c.sentiment === "positive").length) / cmtRows.length) * 100) : 0,
  totalPosts: postRows?.length ?? 0,
  totalLikes: (postRows ?? []).reduce((s, p) => s + (p.likes ?? 0), 0),
  totalShares: (postRows ?? []).reduce((s, p) => s + (p.shares ?? 0), 0),
};

// --- what it does now ---
const { data: m, error } = await admin.rpc("dashboard_metrics", { p_tenant_id: TENANT });
if (error) { console.error(error); process.exit(1); }
const now = {
  donations: Number(m.donations),
  comments: Number(m.comments),
  pendingComments: Number(m.pending_comments),
  sentimentScore: Number(m.comments) ? Math.round((Number(m.sentiment.positive) / Number(m.comments)) * 100) : 0,
  totalPosts: Number(m.posts),
  totalLikes: Number(m.likes),
  totalShares: Number(m.shares),
};

// --- ground truth straight from SQL, via a separate path ---
const truth = {};
for (const [key, sql] of Object.entries({
  donations: "select coalesce(sum(amount),0)::numeric from donations where tenant_id = $1",
})) void key, void sql;

console.log("row cap hit on donations select:", old.donationRowsSeen, "rows returned\n");
console.table(
  ["donations", "comments", "pendingComments", "sentimentScore", "totalPosts", "totalLikes", "totalShares"].map((k) => ({
    KPI: k, "old (JS reduce)": old[k], "new (SQL aggregate)": now[k], wrong: old[k] !== now[k] ? "YES" : "",
  }))
);
