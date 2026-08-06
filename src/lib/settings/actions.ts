"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, logAudit } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export async function updateOwnProfile(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized" };

  const fullName = String(formData.get("full_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const ward = String(formData.get("ward") ?? "").trim() || null;
  const lga = String(formData.get("lga") ?? "").trim() || null;

  if (!fullName) return { error: "Full name is required" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: fullName,
      phone,
      ward,
      lga,
    })
    .eq("id", user.id);

  if (error) return { error: error.message };

  await logAudit("settings.profile_update", "user", user.id, {
    full_name: fullName,
    ward,
    lga,
  });
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { success: true as const };
}
