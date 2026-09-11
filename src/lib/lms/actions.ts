"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { authorize } from "@/lib/auth/session";
import { denyWriteIfRestricted } from "@/types/auth";
import { extraEnrollCourse, ensureTrainingCode, logLmsActivity, removeEnrollment } from "./enroll";
import { getTrainingOverview } from "./hq-data";
import { resolveAppHost, sendVolunteerTrainingCodes, volunteerLearnLoginUrl } from "./send-training-code";
import { termiiEmailConfigured, termiiWhatsAppConfigured } from "@/lib/integrations/termii/client";

async function manageGate() {
  const gate = await authorize("training.manage");
  if (!gate.ok) return { error: gate.error as string };
  const blocked = denyWriteIfRestricted(gate.user.role);
  if (blocked) return { error: blocked };
  return { user: gate.user, supabase: await createClient() };
}

export async function assignHqCourse(volunteerId: string, courseId: string, required = false) {
  const gate = await manageGate();
  if ("error" in gate) return { error: gate.error };
  const { user, supabase } = gate;
  const result = await extraEnrollCourse(supabase, {
    tenantId: user.profile.tenant_id,
    volunteerId,
    courseId,
    actorId: user.id,
    required,
  });
  revalidatePath("/training");
  revalidatePath(`/volunteers/${volunteerId}`);
  return result;
}

export async function removeHqCourse(volunteerId: string, courseId: string) {
  const gate = await manageGate();
  if ("error" in gate) return { error: gate.error };
  const { user, supabase } = gate;
  const result = await removeEnrollment(supabase, {
    tenantId: user.profile.tenant_id,
    volunteerId,
    courseId,
    actorId: user.id,
  });
  revalidatePath("/training");
  revalidatePath(`/volunteers/${volunteerId}`);
  return result;
}

export async function setCourseStatus(courseId: string, status: "draft" | "published" | "archived") {
  const gate = await manageGate();
  if ("error" in gate) return { error: gate.error };
  const { user, supabase } = gate;
  const { error } = await supabase
    .from("lms_courses")
    .update({ status })
    .eq("id", courseId)
    .eq("tenant_id", user.profile.tenant_id);
  if (error) return { error: error.message };
  await logLmsActivity(supabase, {
    tenantId: user.profile.tenant_id,
    actorId: user.id,
    action: "training.course_status",
    detail: `Course set to ${status}`,
    metadata: { course_id: courseId, status },
  });
  revalidatePath("/training");
  return { success: true as const };
}

export async function duplicateCourse(courseId: string) {
  const gate = await manageGate();
  if ("error" in gate) return { error: gate.error };
  const { user, supabase } = gate;
  const { data: course } = await supabase
    .from("lms_courses")
    .select("*")
    .eq("id", courseId)
    .eq("tenant_id", user.profile.tenant_id)
    .maybeSingle();
  if (!course) return { error: "Course not found." };
  const slug = `${course.slug}-copy-${Date.now().toString(36)}`;
  const { data: copy, error } = await supabase
    .from("lms_courses")
    .insert({
      tenant_id: user.profile.tenant_id,
      slug,
      title: `${course.title} (copy)`,
      description: course.description,
      role_slug: course.role_slug,
      estimated_minutes: course.estimated_minutes,
      status: "draft",
      pass_mark: course.pass_mark,
      max_attempts: course.max_attempts,
      is_required: false,
      sort_order: (course.sort_order ?? 0) + 50,
    })
    .select("id")
    .single();
  if (error || !copy) return { error: error?.message ?? "Could not duplicate." };
  const { data: modules } = await supabase.from("lms_modules").select("*").eq("course_id", courseId);
  if (modules?.length) {
    await supabase.from("lms_modules").insert(
      modules.map((m) => ({
        tenant_id: user.profile.tenant_id,
        course_id: copy.id,
        slug: m.slug,
        title: m.title,
        kind: m.kind,
        body: m.body,
        resource_url: m.resource_url,
        estimated_minutes: m.estimated_minutes,
        sort_order: m.sort_order,
        quiz: m.quiz,
      }))
    );
  }
  revalidatePath("/training");
  return { success: true as const, id: copy.id };
}

export async function saveCourseMeta(courseId: string, formData: FormData) {
  const gate = await manageGate();
  if ("error" in gate) return { error: gate.error };
  const { user, supabase } = gate;
  const { error } = await supabase
    .from("lms_courses")
    .update({
      title: String(formData.get("title") ?? ""),
      description: String(formData.get("description") ?? "") || null,
      pass_mark: Number(formData.get("pass_mark") || 70),
      max_attempts: Number(formData.get("max_attempts") || 3),
      estimated_minutes: Number(formData.get("estimated_minutes") || 20),
      is_required: formData.get("is_required") === "on",
    })
    .eq("id", courseId)
    .eq("tenant_id", user.profile.tenant_id);
  if (error) return { error: error.message };
  revalidatePath("/training");
  return { success: true as const };
}

function whatsappRecipientCap() {
  const configured = Number(process.env.COMMUNICATIONS_MAX_RECIPIENTS);
  return Number.isFinite(configured) && configured > 0 ? Math.min(Math.floor(configured), 200) : 200;
}

export async function sendTrainingCodesWhatsApp(volunteerIds?: string[]) {
  const gate = await manageGate();
  if ("error" in gate) return { error: gate.error };
  const { user, supabase } = gate;
  if (!termiiWhatsAppConfigured() && !termiiEmailConfigured()) {
    return {
      error:
        "Training-code delivery is not configured. Add Termii WhatsApp device/template IDs and/or TERMII_EMAIL_CONFIGURATION_ID in Vercel.",
    };
  }
  const overview = await getTrainingOverview();
  if ("error" in overview) return { error: overview.error };
  const selected = volunteerIds?.filter(Boolean) ?? [];
  let people = overview.volunteers;
  if (selected.length) {
    const want = new Set(selected);
    people = people.filter((volunteer) => want.has(volunteer.id));
  }
  const cap = whatsappRecipientCap();
  if (people.length > cap) people = people.slice(0, cap);

  const slug = user.workspace?.slug ?? "";
  const learnUrl = volunteerLearnLoginUrl(slug, resolveAppHost());
  if (!learnUrl) {
    return { error: "NEXT_PUBLIC_APP_URL is not set. Training login link cannot be built." };
  }

  let sent = 0;
  let whatsappSent = 0;
  let emailSent = 0;
  let failed = 0;
  let lastError = "";
  for (const volunteer of people) {
    let code = volunteer.training_code ?? "";
    if (!code) {
      try {
        code = await ensureTrainingCode(supabase, user.profile.tenant_id, volunteer.id, null);
      } catch {
        failed += 1;
        lastError = "Could not create a training code for a volunteer.";
        continue;
      }
    }
    const result = await sendVolunteerTrainingCodes({
      supabase,
      tenantId: user.profile.tenant_id,
      volunteerId: volunteer.id,
      actorId: user.id,
      phone: volunteer.phone,
      email: volunteer.email,
      name: volunteer.full_name,
      trainingCode: code,
      learnUrl,
      requireConfigured: true,
    });
    if (result.whatsappSent) whatsappSent += 1;
    if (result.emailSent) emailSent += 1;
    if (result.whatsappSent || result.emailSent) sent += 1;
    else {
      failed += 1;
      if (result.error) lastError = result.error;
    }
  }

  revalidatePath("/training");
  if (!sent && failed) {
    return { error: lastError || "Could not send training codes.", sent, failed, whatsappSent, emailSent };
  }
  return { success: true as const, sent, failed, whatsappSent, emailSent };
}

export async function sendTrainingReminders() {
  const gate = await manageGate();
  if ("error" in gate) return { error: gate.error };
  const { user, supabase } = gate;
  const overview = await getTrainingOverview();
  if ("error" in overview) return overview;
  let sent = 0;
  for (const volunteer of overview.overdue) {
    await logLmsActivity(supabase, {
      tenantId: user.profile.tenant_id,
      volunteerId: volunteer.id,
      actorId: user.id,
      action: "training.reminder",
      detail: `Please finish your required training before the deadline.`,
      metadata: { source: "hq_bulk" },
    });
    sent += 1;
  }
  revalidatePath("/training");
  return { success: true as const, sent };
}

export async function createLiveSession(formData: FormData) {
  const gate = await manageGate();
  if ("error" in gate) return { error: gate.error };
  const { user, supabase } = gate;
  const title = String(formData.get("title") ?? "").trim();
  const startsAt = String(formData.get("starts_at") ?? "");
  if (!title || !startsAt) return { error: "Title and start time are required." };
  const { error } = await supabase.from("lms_live_sessions").insert({
    tenant_id: user.profile.tenant_id,
    course_id: String(formData.get("course_id") ?? "") || null,
    title,
    description: String(formData.get("description") ?? "") || null,
    starts_at: new Date(startsAt).toISOString(),
    location: String(formData.get("location") ?? "") || null,
    meeting_url: String(formData.get("meeting_url") ?? "") || null,
    capacity: Number(formData.get("capacity") || 0) || null,
    follow_up: String(formData.get("follow_up") ?? "") || null,
  });
  if (error) return { error: error.message };
  revalidatePath("/training");
  return { success: true as const };
}

export async function setSessionAttendance(attendeeId: string, status: "registered" | "attended" | "no_show") {
  const gate = await manageGate();
  if ("error" in gate) return { error: gate.error };
  const { user, supabase } = gate;
  const { error } = await supabase
    .from("lms_session_attendees")
    .update({ status })
    .eq("id", attendeeId)
    .eq("tenant_id", user.profile.tenant_id);
  if (error) return { error: error.message };
  revalidatePath("/training");
  return { success: true as const };
}

export async function exportTrainingCsv() {
  const overview = await getTrainingOverview();
  if ("error" in overview) return { error: overview.error, csv: "" };
  const lines = [
    ["name", "phone", "lga", "ward", "roles", "training_status", "deployment_ready", "trained_at", "training_code"].join(","),
    ...overview.volunteers.map((v) =>
      [
        csv(v.full_name),
        csv(v.phone),
        csv(v.lga),
        csv(v.ward),
        csv((v.support_roles ?? []).join("|")),
        csv(v.training_status),
        v.deployment_ready ? "yes" : "no",
        csv(v.trained_at),
        csv(v.training_code),
      ].join(",")
    ),
  ];
  return { csv: lines.join("\n") };
}

function csv(value: unknown) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}
