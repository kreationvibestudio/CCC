"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";

export async function createVolunteer(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized" };
  const supabase = await createClient();
  const skills = (formData.get("skills") as string)?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
  const { error } = await supabase.from("volunteers").insert({
    tenant_id: user.profile.tenant_id,
    full_name: formData.get("full_name") as string,
    phone: formData.get("phone") as string,
    email: formData.get("email") as string || null,
    ward: formData.get("ward") as string || null,
    lga: formData.get("lga") as string || null,
    polling_unit: formData.get("polling_unit") as string || null,
    skills,
    training_status: formData.get("training_status") as string || "pending",
  });
  if (error) return { error: error.message };
  revalidatePath("/volunteers");
  return { success: true };
}

export async function getVolunteers(tenantId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("volunteers").select("*").eq("tenant_id", tenantId).order("full_name");
  return data ?? [];
}
