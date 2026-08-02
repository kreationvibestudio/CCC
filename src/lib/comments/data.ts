import { createClient } from "@/lib/supabase/server";
import type { Comment } from "@/types/database";

export interface TeamMember {
  id: string;
  full_name: string;
  role: string;
}

export async function getTeamMembers(tenantId: string): Promise<TeamMember[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("tenant_id", tenantId)
    .in("role", [
      "super_administrator", "campaign_director", "media_director",
      "social_media_team", "call_center_agent", "data_analyst",
    ])
    .order("full_name");

  return data ?? [];
}

export async function getCommentsWithResponses(tenantId: string): Promise<Comment[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("comments")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("priority_score", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);

  return (data ?? []) as Comment[];
}
