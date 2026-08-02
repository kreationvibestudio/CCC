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
