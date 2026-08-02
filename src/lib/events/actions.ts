"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";

export async function createEvent(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized" };
  const supabase = await createClient();
  const qrCode = `evt-${crypto.randomUUID().slice(0, 8)}`;
  const { error } = await supabase.from("campaign_events").insert({
    tenant_id: user.profile.tenant_id,
    title: formData.get("title") as string,
    event_type: formData.get("event_type") as string,
    description: formData.get("description") as string || null,
    location: formData.get("location") as string,
    ward: formData.get("ward") as string || null,
    lga: formData.get("lga") as string || null,
    starts_at: formData.get("starts_at") as string,
    ends_at: formData.get("ends_at") as string || null,
    max_attendees: formData.get("max_attendees") ? Number(formData.get("max_attendees")) : null,
    qr_code: qrCode,
    created_by: user.id,
  });
  if (error) return { error: error.message };
  revalidatePath("/events");
  return { success: true };
}

export async function getEvents(tenantId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("campaign_events").select("*").eq("tenant_id", tenantId).order("starts_at", { ascending: false });
  return data ?? [];
}
