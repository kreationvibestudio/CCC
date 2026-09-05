"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { authorize } from "@/lib/auth/session";

export async function createTemplate(formData: FormData) {
  const gate = await authorize("communications.send");
  if (!gate.ok) return { error: gate.error };
  const user = gate.user;
  const supabase = await createClient();
  const { error } = await supabase.from("message_templates").insert({
    tenant_id: user.profile.tenant_id,
    name: formData.get("name") as string,
    // Product ships Termii SMS only for now.
    channel: "sms",
    subject: null,
    body: formData.get("body") as string,
  });
  if (error) return { error: error.message };
  revalidatePath("/communications");
  return { success: true };
}

export async function createCampaign(formData: FormData) {
  const gate = await authorize("communications.send");
  if (!gate.ok) return { error: gate.error };
  const user = gate.user;
  const supabase = await createClient();
  const templateId = (formData.get("template_id") as string | null)?.trim() || null;
  const { error } = await supabase.from("message_campaigns").insert({
    tenant_id: user.profile.tenant_id,
    name: formData.get("name") as string,
    channel: "sms",
    template_id: templateId,
    status: "draft",
    created_by: user.id,
  });
  if (error) return { error: error.message };
  revalidatePath("/communications");
  return { success: true };
}

/** Tenant comes from the session, never from a caller-supplied argument. */
export async function getTemplates() {
  const gate = await authorize("communications.view");
  if (!gate.ok) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("message_templates")
    .select("*")
    .eq("tenant_id", gate.user.profile.tenant_id)
    .order("name");
  return data ?? [];
}

/** Tenant comes from the session, never from a caller-supplied argument. */
export async function getCampaigns() {
  const gate = await authorize("communications.view");
  if (!gate.ok) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("message_campaigns")
    .select("*")
    .eq("tenant_id", gate.user.profile.tenant_id)
    .order("created_at", { ascending: false });
  return data ?? [];
}
