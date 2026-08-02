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

export async function getVolunteer(id: string) {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("volunteers").select("*").eq("id", id).eq("tenant_id", user.profile.tenant_id).single();
  return data;
}

export async function updateVolunteer(id: string, formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized" };
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
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized" };
  const supabase = await createClient();
  const { error } = await supabase.from("volunteers").delete().eq("id", id).eq("tenant_id", user.profile.tenant_id);
  if (error) return { error: error.message };
  revalidatePath("/volunteers");
  return { success: true };
}

export async function assignVolunteerTask(volunteerId: string, formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized" };
  const supabase = await createClient();
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
  const supabase = await createClient();
  const { data } = await supabase.from("volunteer_tasks").select("*").eq("volunteer_id", volunteerId).order("created_at", { ascending: false });
  return data ?? [];
}
