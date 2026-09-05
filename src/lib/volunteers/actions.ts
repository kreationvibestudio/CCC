"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { authorize } from "@/lib/auth/session";
import { fetchAllRows } from "@/lib/supabase/paginate";
import type { Volunteer } from "@/types/database";

export async function createVolunteer(formData: FormData) {
  const gate = await authorize("volunteers.manage");
  if (!gate.ok) return { error: gate.error };
  const user = gate.user;
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

/** Tenant comes from the session, never from a caller-supplied argument. */
export async function getVolunteers() {
  const gate = await authorize("volunteers.view");
  if (!gate.ok) return [];
  const supabase = await createClient();
  return fetchAllRows<Volunteer>(
    (from, to) =>
      supabase
        .from("volunteers")
        .select("*")
        .eq("tenant_id", gate.user.profile.tenant_id)
        .order("full_name")
        .range(from, to),
    { max: 10000 }
  );
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
  const supabase = await createClient();
  const skills = (formData.get("skills") as string)?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
  const { error } = await supabase.from("volunteers").update({
    full_name: formData.get("full_name"),
    phone: formData.get("phone"),
    email: formData.get("email") || null,
    ward: formData.get("ward") || null,
    lga: formData.get("lga") || null,
    polling_unit: formData.get("polling_unit") || null,
    skills,
    training_status: formData.get("training_status") || "pending",
  }).eq("id", id).eq("tenant_id", user.profile.tenant_id);
  if (error) return { error: error.message };
  revalidatePath("/volunteers");
  revalidatePath(`/volunteers/${id}`);
  return { success: true };
}

export async function deleteVolunteer(id: string) {
  const gate = await authorize("volunteers.manage");
  if (!gate.ok) return { error: gate.error };
  const user = gate.user;
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
