"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { authorize } from "@/lib/auth/session";
import { denyCreateIfRestricted, denyDeleteIfRestricted } from "@/types/auth";
import { fetchAllRows } from "@/lib/supabase/paginate";
import type { CampaignEvent } from "@/types/database";
import { assertEventInTenant } from "@/lib/tenancy";
import { formDateTimeToIso, omitUnmigratedEventColumns } from "@/lib/events/event-columns";
import {
  EVENT_TYPE_TEXT_MIGRATION_SQL,
  isInvalidEventTypeEnumError,
  normalizeEventType,
} from "@/lib/events/event-types";
import { isMissingColumnError } from "@/lib/public-error";
import { createServiceClient } from "@/lib/supabase/admin";

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

async function insertCampaignEvent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  payload: Record<string, unknown>
) {
  let current = payload;
  for (let attempt = 0; attempt < 3; attempt++) {
    const { error } = await supabase.from("campaign_events").insert(current);
    if (!error) return { success: true as const };
    const stripped = omitUnmigratedEventColumns(current, error.message);
    if (!stripped) return { error: error.message };
    current = stripped;
  }
  return { error: "Could not create event" };
}

async function updateCampaignEvent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string,
  tenantId: string,
  payload: Record<string, unknown>
) {
  let current = payload;
  for (let attempt = 0; attempt < 3; attempt++) {
    const { error } = await supabase
      .from("campaign_events")
      .update(current)
      .eq("id", id)
      .eq("tenant_id", tenantId);
    if (!error) return { success: true as const };
    const stripped = omitUnmigratedEventColumns(current, error.message);
    if (!stripped) return { error: error.message };
    current = stripped;
  }
  return { error: "Could not update event" };
}

export async function createEvent(formData: FormData) {
  const gate = await authorize("events.manage");
  if (!gate.ok) return { error: gate.error };
  const user = gate.user;
  const blocked = denyCreateIfRestricted(user.role);
  if (blocked) return { error: blocked };

  const title = String(formData.get("title") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const startsAt = formDateTimeToIso(formData.get("starts_at"));
  if (!title || !location || !startsAt) {
    return { error: "Title, location, and start time are required." };
  }
  const endsAtRaw = formData.get("ends_at");
  const endsAt = String(endsAtRaw ?? "").trim() ? formDateTimeToIso(endsAtRaw) : null;
  if (String(endsAtRaw ?? "").trim() && !endsAt) {
    return { error: "End time is invalid." };
  }

  const eventType = normalizeEventType(formData.get("event_type"));
  const supabase = await createClient();
  const qrCode = `evt-${crypto.randomUUID().slice(0, 8)}`;
  const result = await insertCampaignEvent(supabase, {
    tenant_id: user.profile.tenant_id,
    title,
    event_type: eventType,
    description: String(formData.get("description") ?? "").trim() || null,
    location,
    ward: String(formData.get("ward") ?? "").trim() || null,
    lga: String(formData.get("lga") ?? "").trim() || null,
    starts_at: startsAt,
    ends_at: endsAt,
    max_attendees: formData.get("max_attendees") ? Number(formData.get("max_attendees")) : null,
    qr_code: qrCode,
    created_by: user.id,
    requires_trained: formData.get("requires_trained") === "on",
    required_role_slug: String(formData.get("required_role_slug") ?? "") || null,
  });
  if ("error" in result && result.error) {
    if (isInvalidEventTypeEnumError(result.error)) {
      return {
        error:
          "This event type needs a one-time database update. Use Copy event-type SQL on the New Event page, run it in Supabase, then try again.",
        needsEventTypeMigration: true as const,
      };
    }
    return { error: result.error };
  }
  revalidatePath("/events");
  revalidatePath("/events/calendar");
  return { success: true };
}

/** Form action for /events/new — keeps the Server Action id on a stable module. */
export async function createEventFormAction(formData: FormData) {
  "use server";
  const result = await createEvent(formData);
  if (result.error) {
    const flag = "needsEventTypeMigration" in result && result.needsEventTypeMigration ? "&needsMigration=1" : "";
    redirect(`/events/new?error=${encodeURIComponent(result.error)}${flag}`);
  }
  redirect("/events/calendar");
}

/** True when production still has the closed event_type enum (new presets / custom blocked). */
export async function eventTypeColumnNeedsMigration(): Promise<boolean> {
  try {
    const admin = createServiceClient();
    const { data: tenant } = await admin.from("tenants").select("id").limit(1).maybeSingle();
    if (!tenant?.id) return false;
    const probe = await admin
      .from("campaign_events")
      .insert({
        tenant_id: tenant.id,
        title: "__event_type_probe__",
        event_type: "family_meeting",
        location: "probe",
        starts_at: new Date().toISOString(),
        qr_code: `probe-${crypto.randomUUID().slice(0, 8)}`,
      })
      .select("id")
      .maybeSingle();
    if (probe.data?.id) {
      await admin.from("campaign_events").delete().eq("id", probe.data.id);
      return false;
    }
    return isInvalidEventTypeEnumError(probe.error?.message);
  } catch {
    return false;
  }
}

export async function getEventTypeMigrationSql() {
  const gate = await authorize("events.manage");
  if (!gate.ok) return { error: gate.error };
  return { sql: EVENT_TYPE_TEXT_MIGRATION_SQL };
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
  const blocked = denyCreateIfRestricted(user.role);
  if (blocked) return { error: blocked };

  const title = String(formData.get("title") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const startsAt = formDateTimeToIso(formData.get("starts_at"));
  if (!title || !location || !startsAt) {
    return { error: "Title, location, and start time are required." };
  }
  const endsAtRaw = formData.get("ends_at");
  const endsAt = String(endsAtRaw ?? "").trim() ? formDateTimeToIso(endsAtRaw) : null;
  if (String(endsAtRaw ?? "").trim() && !endsAt) {
    return { error: "End time is invalid." };
  }

  const supabase = await createClient();
  const result = await updateCampaignEvent(supabase, id, user.profile.tenant_id, {
    title,
    event_type: normalizeEventType(formData.get("event_type") || "town_hall"),
    description: String(formData.get("description") ?? "").trim() || null,
    location,
    ward: String(formData.get("ward") ?? "").trim() || null,
    lga: String(formData.get("lga") ?? "").trim() || null,
    starts_at: startsAt,
    ends_at: endsAt,
    max_attendees: formData.get("max_attendees") ? Number(formData.get("max_attendees")) : null,
    requires_trained: formData.get("requires_trained") === "on",
    required_role_slug: String(formData.get("required_role_slug") ?? "") || null,
  });
  if ("error" in result && result.error) return { error: result.error };
  revalidatePath("/events");
  revalidatePath("/events/calendar");
  revalidatePath(`/events/${id}`);
  return { success: true };
}

export async function deleteEvent(id: string) {
  const gate = await authorize("events.manage");
  if (!gate.ok) return { error: gate.error };
  const user = gate.user;
  const blocked = denyDeleteIfRestricted(user.role);
  if (blocked) return { error: blocked };
  const supabase = await createClient();
  const { error } = await supabase.from("campaign_events").delete().eq("id", id).eq("tenant_id", user.profile.tenant_id);
  if (error) return { error: error.message };
  revalidatePath("/events");
  revalidatePath("/events/calendar");
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

export async function inviteEligibleVolunteers(eventId: string) {
  const gate = await authorize("events.manage");
  if (!gate.ok) return { error: gate.error };
  const blocked = denyCreateIfRestricted(gate.user.role);
  if (blocked) return { error: blocked };
  const eventError = await assertEventInTenant(gate.user.profile.tenant_id, eventId);
  if (eventError) return { error: eventError };
  const supabase = await createClient();
  let event: { id: string; requires_trained?: boolean | null; required_role_slug?: string | null } | null =
    null;
  {
    const full = await supabase
      .from("campaign_events")
      .select("id, requires_trained, required_role_slug")
      .eq("id", eventId)
      .eq("tenant_id", gate.user.profile.tenant_id)
      .maybeSingle();
    if (
      full.error &&
      (isMissingColumnError(full.error.message, "requires_trained") ||
        isMissingColumnError(full.error.message, "required_role_slug"))
    ) {
      const basic = await supabase
        .from("campaign_events")
        .select("id")
        .eq("id", eventId)
        .eq("tenant_id", gate.user.profile.tenant_id)
        .maybeSingle();
      if (basic.error) return { error: basic.error.message };
      event = basic.data;
    } else if (full.error) {
      return { error: full.error.message };
    } else {
      event = full.data;
    }
  }
  if (!event) return { error: "Event not found" };
  const { getEligibleVolunteers } = await import("@/lib/lms/hq-data");
  const eligible = await getEligibleVolunteers({
    roleSlug: event.required_role_slug ?? null,
    requireReady: event.requires_trained !== false,
  });
  const { data: existing } = await supabase.from("event_attendees").select("volunteer_id").eq("event_id", eventId);
  const have = new Set((existing ?? []).map((a) => a.volunteer_id).filter(Boolean));
  const toAdd = eligible.filter((v) => !have.has(v.id));
  if (toAdd.length) {
    const { error } = await supabase.from("event_attendees").insert(
      toAdd.map((v) => ({
        event_id: eventId,
        volunteer_id: v.id,
        name: v.full_name,
        phone: v.phone,
        rsvp_status: "invited",
      }))
    );
    if (error) return { error: error.message };
  }
  revalidatePath(`/events/${eventId}`);
  return { success: true as const, invited: toAdd.length };
}
