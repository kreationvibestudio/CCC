"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";

export async function submitAgentReport(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized" };
  const supabase = await createClient();
  const { error } = await supabase.from("agent_reports").insert({
    tenant_id: user.profile.tenant_id,
    agent_id: user.id,
    report_type: formData.get("report_type") as string,
    content: formData.get("content") as string,
    polling_unit_id: (formData.get("polling_unit_id") as string) || null,
  });
  if (error) return { error: error.message };
  revalidatePath("/agent");
  return { success: true };
}

export async function reportIncident(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized" };
  const supabase = await createClient();
  const { error } = await supabase.from("incident_reports").insert({
    tenant_id: user.profile.tenant_id,
    reporter_id: user.id,
    title: formData.get("title") as string,
    description: formData.get("description") as string,
    severity: (formData.get("severity") as string) || "medium",
    is_emergency: formData.get("is_emergency") === "true",
    latitude: formData.get("latitude") ? Number(formData.get("latitude")) : null,
    longitude: formData.get("longitude") ? Number(formData.get("longitude")) : null,
  });
  if (error) return { error: error.message };
  revalidatePath("/situation-room");
  return { success: true };
}

export async function updatePuStatus(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized" };
  const supabase = await createClient();
  const puId = formData.get("polling_unit_id") as string;
  const { error } = await supabase.from("polling_unit_status").upsert({
    tenant_id: user.profile.tenant_id,
    polling_unit_id: puId,
    status: formData.get("status") as string,
    turnout: formData.get("turnout") ? Number(formData.get("turnout")) : 0,
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  }, { onConflict: "tenant_id,polling_unit_id" });
  if (error) return { error: error.message };
  revalidatePath("/situation-room");
  return { success: true };
}
