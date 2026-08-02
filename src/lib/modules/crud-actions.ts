"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";

export async function deleteRecord(table: string, id: string, revalidate: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized" };
  const supabase = await createClient();
  const { error } = await supabase.from(table).delete().eq("id", id).eq("tenant_id", user.profile.tenant_id);
  if (error) return { error: error.message };
  revalidatePath(revalidate);
  return { success: true };
}

export async function getRecord<T>(table: string, id: string): Promise<T | null> {
  const user = await getCurrentUser();
  if (!user) return null;
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
  const supabase = await createClient();
  const { error } = await supabase.from(table).update(updates).eq("id", id).eq("tenant_id", user.profile.tenant_id);
  if (error) return { error: error.message };
  revalidatePath(revalidate);
  return { success: true };
}
