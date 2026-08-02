"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";

export async function createContact(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized" };
  const supabase = await createClient();
  const { error } = await supabase.from("contacts").insert({
    tenant_id: user.profile.tenant_id,
    full_name: formData.get("full_name") as string,
    contact_type: formData.get("contact_type") as string,
    phone: formData.get("phone") as string || null,
    email: formData.get("email") as string || null,
    ward: formData.get("ward") as string || null,
    lga: formData.get("lga") as string || null,
    support_level: formData.get("support_level") as string || "undecided",
  });
  if (error) return { error: error.message };
  revalidatePath("/crm");
  return { success: true };
}

export async function getContacts(tenantId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("contacts").select("*").eq("tenant_id", tenantId).order("full_name");
  return data ?? [];
}
