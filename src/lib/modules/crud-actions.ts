"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";

const ALLOWED_TABLES = new Set([
  "polling_units",
  "volunteers",
  "contacts",
  "campaign_events",
  "message_templates",
  "message_campaigns",
]);

function assertTable(table: string) {
  if (!ALLOWED_TABLES.has(table)) return "Invalid table";
  return null;
}

export async function deleteRecord(table: string, id: string, revalidate: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized" };
  const invalid = assertTable(table);
  if (invalid) return { error: invalid };
  const supabase = await createClient();
  const { error } = await supabase.from(table).delete().eq("id", id).eq("tenant_id", user.profile.tenant_id);
  if (error) return { error: error.message };
  revalidatePath(revalidate);
  return { success: true };
}

export async function getRecord<T>(table: string, id: string): Promise<T | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  if (assertTable(table)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from(table).select("*").eq("id", id).eq("tenant_id", user.profile.tenant_id).single();
  return data as T | null;
}

export async function updateRecord(
  table: string,
  id: string,
  updates: Record<string, unknown>,
  revalidate: string
) {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized" };
  const invalid = assertTable(table);
  if (invalid) return { error: invalid };
  const supabase = await createClient();
  const { error } = await supabase.from(table).update(updates).eq("id", id).eq("tenant_id", user.profile.tenant_id);
  if (error) return { error: error.message };
  revalidatePath(revalidate);
  return { success: true };
}
