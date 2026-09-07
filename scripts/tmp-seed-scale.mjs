// Temporary: seed >1000 donations and comments to prove the truncation fix.
import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal } from "./load-env.mjs";
loadEnvLocal();
const TENANT = "a0000000-0000-0000-0000-000000000001";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const donations = Array.from({ length: 0 }, (_, i) => ({
  tenant_id: TENANT, amount: 1000, currency: "NGN", payment_method: "transfer",
  payment_reference: `seed-${i}`,
}));
const sentiments = ["positive", "neutral", "negative"];
const topics = ["roads", "employment", "security", "education"];
const comments = Array.from({ length: 1200 }, (_, i) => ({
  tenant_id: TENANT, platform: "facebook", platform_comment_id: `seed-c-${i}`,
  author_name: `Seed ${i}`, content: `seed comment ${i}`,
  sentiment: sentiments[i % 3], issue_topic: topics[i % 4],
  status: i % 5 === 0 ? "pending" : "replied",
  is_misinformation: i % 100 === 0,
}));
const posts = Array.from({ length: 40 }, (_, i) => ({
  tenant_id: TENANT, platform: "facebook", platform_post_id: `seed-p-${i}`,
  content: `seed post ${i}`, likes: 10, shares: 5, comments_count: 3,
  posted_at: new Date(Date.now() - i * 86400000).toISOString(),
}));

for (const [table, rows] of [["donations", donations], ["comments", comments], ["social_posts", posts]]) {
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await admin.from(table).insert(rows.slice(i, i + 500));
    if (error) { console.error(table, error.message); process.exit(1); }
  }
  console.log(`seeded ${rows.length} ${table}`);
}
