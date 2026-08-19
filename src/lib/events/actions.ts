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

export async function getEvent(id: string) {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("campaign_events").select("*").eq("id", id).eq("tenant_id", user.profile.tenant_id).single();
  return data;
}

/** Public check-in — no auth; scoped by event id only */
export async function getEventPublic(id: string) {
  const { createServiceClient } = await import("@/lib/supabase/admin");
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("campaign_events")
    .select("id, title, location, qr_code, tenant_id")
    .eq("id", id)
    .maybeSingle();
  return data;
}

export async function updateEvent(id: string, formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized" };
  const supabase = await createClient();
  const { error } = await supabase.from("campaign_events").update({
    title: formData.get("title"),
    event_type: formData.get("event_type"),
    description: formData.get("description") || null,
    location: formData.get("location"),
    ward: formData.get("ward") || null,
    lga: formData.get("lga") || null,
    starts_at: formData.get("starts_at"),
    ends_at: formData.get("ends_at") || null,
    max_attendees: formData.get("max_attendees") ? Number(formData.get("max_attendees")) : null,
  }).eq("id", id).eq("tenant_id", user.profile.tenant_id);
  if (error) return { error: error.message };
  revalidatePath("/events");
  revalidatePath(`/events/${id}`);
  return { success: true };
}

export async function deleteEvent(id: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized" };
  const supabase = await createClient();
  const { error } = await supabase.from("campaign_events").delete().eq("id", id).eq("tenant_id", user.profile.tenant_id);
  if (error) return { error: error.message };
  revalidatePath("/events");
  return { success: true };
}

export async function checkInAttendee(eventId: string, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  if (!name || !phone) return { error: "Name and phone are required" };

  const { createServiceClient } = await import("@/lib/supabase/admin");
  const supabase = createServiceClient();
  const { data: event } = await supabase.from("campaign_events").select("id").eq("id", eventId).maybeSingle();
  if (!event) return { error: "Event not found" };

  const { data: attendee, error: aErr } = await supabase
    .from("event_attendees")
    .insert({
      event_id: eventId,
      name,
      phone,
      rsvp_status: "checked_in",
    })
    .select("id")
    .single();
  if (aErr) return { error: aErr.message };
  await supabase.from("event_checkins").insert({ event_id: eventId, attendee_id: attendee.id, method: "qr" });
  revalidatePath(`/events/${eventId}`);
  return { success: true };
}

export async function getEventAttendees(eventId: string) {
  const user = await getCurrentUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("event_attendees").select("*").eq("event_id", eventId).order("created_at", { ascending: false });
  return data ?? [];
}
