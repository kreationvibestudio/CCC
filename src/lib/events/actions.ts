"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { authorize } from "@/lib/auth/session";
import { fetchAllRows } from "@/lib/supabase/paginate";
import type { CampaignEvent } from "@/types/database";
import { assertEventInTenant } from "@/lib/tenancy";

export type EventAttendee = {
  id: string;
  event_id: string;
  contact_id: string | null;
  volunteer_id: string | null;
  name: string;
  phone: string | null;
  rsvp_status: string | null;
  created_at: string | null;
};

export async function createEvent(formData: FormData) {
  const gate = await authorize("events.manage");
  if (!gate.ok) return { error: gate.error };
  const user = gate.user;
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

/** Tenant comes from the session, never from a caller-supplied argument. */
export async function getEvents() {
  const gate = await authorize("events.view");
  if (!gate.ok) return [];
  const supabase = await createClient();
  return fetchAllRows<CampaignEvent>(
    (from, to) =>
      supabase
        .from("campaign_events")
        .select("*")
        .eq("tenant_id", gate.user.profile.tenant_id)
        .order("starts_at", { ascending: false })
        .range(from, to),
    { max: 5000 }
  );
}

export async function getEvent(id: string) {
  const gate = await authorize("events.view");
  if (!gate.ok) return null;
  const user = gate.user;
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
  const gate = await authorize("events.manage");
  if (!gate.ok) return { error: gate.error };
  const user = gate.user;
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
  const gate = await authorize("events.manage");
  if (!gate.ok) return { error: gate.error };
  const user = gate.user;
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

  // Public QR endpoint writing with the service role: bound it per source.
  const verdict = await checkRateLimit("eventCheckIn", `${eventId}:${clientIp(await headers())}`);
  if (!verdict.allowed) {
    return { error: "Too many check-ins from this connection. Try again shortly." };
  }

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
  const gate = await authorize("events.view");
  if (!gate.ok) return [];
  const user = gate.user;
  const eventError = await assertEventInTenant(user.profile.tenant_id, eventId);
  if (eventError) return [];
  const supabase = await createClient();
  // A rally can register more attendees than a single PostgREST response holds.
  return fetchAllRows<EventAttendee>(
    (from, to) =>
      supabase
        .from("event_attendees")
        .select("*")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false })
        .range(from, to),
    { max: 20_000 }
  );
}
