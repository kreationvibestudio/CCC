import { createClient } from "@/lib/supabase/server";

export async function getSocialAccounts(tenantId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("social_accounts")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("platform");

  return data ?? [];
}

export async function getSocialPosts(tenantId: string, platform?: string) {
  const supabase = await createClient();
  let query = supabase
    .from("social_posts")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("posted_at", { ascending: false })
    .limit(50);

  if (platform) {
    query = query.eq("platform", platform);
  }

  const { data } = await query;
  return data ?? [];
}

export async function getComments(tenantId: string, platform?: string) {
  const supabase = await createClient();
  let query = supabase
    .from("comments")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (platform) {
    query = query.eq("platform", platform);
  }

  const { data } = await query;
  return data ?? [];
}

export async function getFacebookAccount(tenantId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("social_accounts")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("platform", "facebook")
    .maybeSingle();

  return data;
}
