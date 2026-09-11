"use server";

import { readFile } from "fs/promises";
import { join } from "path";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { authorize } from "@/lib/auth/session";
import { denyCreateIfRestricted, denyDeleteIfRestricted, denyWriteIfRestricted } from "@/types/auth";
import { fetchAllRows } from "@/lib/supabase/paginate";
import { createServiceClient } from "@/lib/supabase/admin";
import type { Volunteer } from "@/types/database";
import {
  applyTrainingTransition,
  isTrainingStatus,
  type TrainingStatus,
} from "@/lib/volunteers/training";
import { parseSupportRoles } from "@/lib/lms/roles";
import { enrollVolunteer, ensureTrainingCode } from "@/lib/lms/enroll";
import { effectiveTrainingStatus } from "@/lib/lms/progress";
import { resolveAppHost, sendVolunteerTrainingCodes, volunteerLearnLoginUrl } from "@/lib/lms/send-training-code";

export async function createVolunteer(formData: FormData) {
  const gate = await authorize("volunteers.manage");
  if (!gate.ok) return { error: gate.error };
  const user = gate.user;
  const blocked = denyWriteIfRestricted(user.role) ?? denyCreateIfRestricted(user.role);
  if (blocked) return { error: blocked };
  const supabase = await createClient();
  const skills = (formData.get("skills") as string)?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
  const alreadyTrained = formData.get("already_trained") === "on";
  const training = applyTrainingTransition({
    next: alreadyTrained ? "completed" : "pending",
    notes: alreadyTrained ? (formData.get("training_notes") as string) || null : undefined,
  });
  const supportRoles = parseSupportRoles(formData.getAll("support_roles"));
  const { data, error } = await supabase.from("volunteers").insert({
    tenant_id: user.profile.tenant_id,
    full_name: formData.get("full_name") as string,
    phone: formData.get("phone") as string,
    email: formData.get("email") as string || null,
    ward: formData.get("ward") as string || null,
    lga: formData.get("lga") as string || null,
    polling_unit: formData.get("polling_unit") as string || null,
    skills,
    support_roles: supportRoles,
    ...training,
  }).select("id").single();
  if (error) return { error: error.message };
  if (data?.id) {
    try {
      const code = await ensureTrainingCode(supabase, user.profile.tenant_id, data.id, null);
      try {
        await enrollVolunteer(supabase, {
          tenantId: user.profile.tenant_id,
          volunteerId: data.id,
          roles: supportRoles,
          actorId: user.id,
        });
      } catch {
        // LMS catalog is applied on first Training Management visit
      }
      const { data: tenant } = await supabase.from("tenants").select("slug").eq("id", user.profile.tenant_id).maybeSingle();
      const slug = tenant?.slug || user.workspace?.slug || "";
      await sendVolunteerTrainingCodes({
        supabase,
        tenantId: user.profile.tenant_id,
        volunteerId: data.id,
        actorId: user.id,
        phone: String(formData.get("phone") ?? ""),
        email: String(formData.get("email") ?? ""),
        name: String(formData.get("full_name") ?? ""),
        trainingCode: code,
        learnUrl: volunteerLearnLoginUrl(slug, resolveAppHost()),
      });
    } catch {
      // LMS catalog is applied on first Training Management visit
    }
  }
  revalidatePath("/volunteers");
  return { success: true };
}

/** Tenant comes from the session, never from a caller-supplied argument. */
export async function getVolunteers() {
  const gate = await authorize("volunteers.view");
  if (!gate.ok) return [];
  const supabase = await createClient();
  const tenantId = gate.user.profile.tenant_id;
  const volunteers = await fetchAllRows<Volunteer>(
    (from, to) =>
      supabase
        .from("volunteers")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("full_name")
        .range(from, to),
    { max: 10000 }
  );
  try {
    const admin = createServiceClient();
    const enrollments = await fetchAllRows<{ volunteer_id: string; status: string; required: boolean }>(
      (from, to) =>
        admin
          .from("lms_enrollments")
          .select("volunteer_id, status, required")
          .eq("tenant_id", tenantId)
          .range(from, to),
      { max: 50000 }
    );
    const byVolunteer = new Map<string, Array<{ required: boolean; status: string }>>();
    for (const row of enrollments) {
      const list = byVolunteer.get(row.volunteer_id) ?? [];
      list.push({ required: row.required, status: row.status });
      byVolunteer.set(row.volunteer_id, list);
    }
    return volunteers.map((person) => ({
      ...person,
      training_status: effectiveTrainingStatus(person.training_status, byVolunteer.get(person.id) ?? []),
    }));
  } catch {
    return volunteers;
  }
}

export async function getVolunteer(id: string) {
  const gate = await authorize("volunteers.view");
  if (!gate.ok) return null;
  const user = gate.user;
  const supabase = await createClient();
  const { data } = await supabase.from("volunteers").select("*").eq("id", id).eq("tenant_id", user.profile.tenant_id).single();
  return data;
}

export async function updateVolunteer(id: string, formData: FormData) {
  const gate = await authorize("volunteers.manage");
  if (!gate.ok) return { error: gate.error };
  const user = gate.user;
  const blocked = denyWriteIfRestricted(user.role);
  if (blocked) return { error: blocked };
  const supabase = await createClient();
  const skills = (formData.get("skills") as string)?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
  const supportRoles = parseSupportRoles(formData.getAll("support_roles"));
  const { error } = await supabase.from("volunteers").update({
    full_name: formData.get("full_name"),
    phone: formData.get("phone"),
    email: formData.get("email") || null,
    ward: formData.get("ward") || null,
    lga: formData.get("lga") || null,
    polling_unit: formData.get("polling_unit") || null,
    skills,
    support_roles: supportRoles,
  }).eq("id", id).eq("tenant_id", user.profile.tenant_id);
  if (error) return { error: error.message };
  try {
    await enrollVolunteer(supabase, {
      tenantId: user.profile.tenant_id,
      volunteerId: id,
      roles: supportRoles,
      actorId: user.id,
    });
  } catch {
    // catalog may not be migrated yet
  }
  revalidatePath("/volunteers");
  revalidatePath(`/volunteers/${id}`);
  return { success: true };
}

export async function updateVolunteerTraining(
  id: string,
  input: { status: TrainingStatus; notes?: string | null }
) {
  const gate = await authorize("volunteers.manage");
  if (!gate.ok) return { error: gate.error };
  const user = gate.user;
  const blocked = denyWriteIfRestricted(user.role);
  if (blocked) return { error: blocked };
  if (!isTrainingStatus(input.status)) return { error: "Invalid training status" };
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("volunteers")
    .select("id, trained_at")
    .eq("id", id)
    .eq("tenant_id", user.profile.tenant_id)
    .maybeSingle();
  if (!existing) return { error: "Volunteer is not in this campaign workspace" };
  const patch = applyTrainingTransition({
    next: input.status,
    notes: input.notes,
    existingTrainedAt: (existing as { trained_at?: string | null }).trained_at ?? null,
  });
  const { error } = await supabase
    .from("volunteers")
    .update(patch)
    .eq("id", id)
    .eq("tenant_id", user.profile.tenant_id);
  if (error) return { error: error.message };
  revalidatePath("/volunteers");
  revalidatePath(`/volunteers/${id}`);
  return { success: true };
}

export async function getVolunteerTrainingSql() {
  const gate = await authorize("training.view", "volunteers.manage");
  if (!gate.ok) return { error: gate.error, sql: "" };
  const sql = [
    await readFile(join(process.cwd(), "supabase/migrations/20260910000000_volunteer_training.sql"), "utf8"),
    await readFile(join(process.cwd(), "supabase/migrations/20260910120000_volunteer_lms.sql"), "utf8"),
    await readFile(join(process.cwd(), "supabase/migrations/20260910180000_lms_grants_and_catalog.sql"), "utf8"),
  ].join("\n\n");
  return { sql };
}

export async function deleteVolunteer(id: string) {
  const gate = await authorize("volunteers.manage");
  if (!gate.ok) return { error: gate.error };
  const user = gate.user;
  const blocked = denyWriteIfRestricted(user.role) ?? denyDeleteIfRestricted(user.role);
  if (blocked) return { error: blocked };
  const supabase = await createClient();
  const { error } = await supabase.from("volunteers").delete().eq("id", id).eq("tenant_id", user.profile.tenant_id);
  if (error) return { error: error.message };
  revalidatePath("/volunteers");
  return { success: true };
}

export async function assignVolunteerTask(volunteerId: string, formData: FormData) {
  const gate = await authorize("volunteers.manage");
  if (!gate.ok) return { error: gate.error };
  const user = gate.user;
  const blocked = denyWriteIfRestricted(user.role) ?? denyCreateIfRestricted(user.role);
  if (blocked) return { error: blocked };
  const supabase = await createClient();
  const { data: volunteer } = await supabase
    .from("volunteers")
    .select("id")
    .eq("id", volunteerId)
    .eq("tenant_id", user.profile.tenant_id)
    .maybeSingle();
  if (!volunteer) return { error: "Volunteer is not in this campaign workspace" };
  const { error } = await supabase.from("volunteer_tasks").insert({
    tenant_id: user.profile.tenant_id,
    volunteer_id: volunteerId,
    title: formData.get("title") as string,
    description: formData.get("description") as string || null,
    due_date: formData.get("due_date") as string || null,
    assigned_by: user.id,
  });
  if (error) return { error: error.message };
  revalidatePath(`/volunteers/${volunteerId}`);
  return { success: true };
}

export async function getVolunteerTasks(volunteerId: string) {
  const gate = await authorize("volunteers.view");
  if (!gate.ok) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("volunteer_tasks")
    .select("*")
    .eq("volunteer_id", volunteerId)
    .eq("tenant_id", gate.user.profile.tenant_id)
    .order("created_at", { ascending: false });
  return data ?? [];
}
