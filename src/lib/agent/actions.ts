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
  revalidatePath("/agent");
  return { success: true };
}

export async function submitElectionResult(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized" };
  const supabase = await createClient();
  const puId = formData.get("polling_unit_id") as string;
  const partyVotesRaw = formData.get("party_votes") as string;
  let partyVotes = {};
  try {
    partyVotes = JSON.parse(partyVotesRaw || "{}");
  } catch {
    partyVotes = { APC: Number(formData.get("apc_votes") || 0), PDP: Number(formData.get("pdp_votes") || 0) };
  }
  const total = Object.values(partyVotes as Record<string, number>).reduce((a, b) => a + b, 0);
  const { error } = await supabase.from("election_results").insert({
    tenant_id: user.profile.tenant_id,
    polling_unit_id: puId,
    submitted_by: user.id,
    party_votes: partyVotes,
    total_votes: total,
    latitude: formData.get("latitude") ? Number(formData.get("latitude")) : null,
    longitude: formData.get("longitude") ? Number(formData.get("longitude")) : null,
  });
  if (error) return { error: error.message };
  await supabase.from("polling_unit_status").upsert({
    tenant_id: user.profile.tenant_id,
    polling_unit_id: puId,
    status: "results_uploaded",
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  }, { onConflict: "tenant_id,polling_unit_id" });
  revalidatePath("/situation-room");
  return { success: true };
}

export async function getAgentPollingUnits(userId: string, tenantId: string) {
  const supabase = await createClient();
  const { data: assigned } = await supabase
    .from("polling_units")
    .select("id, code, name, ward, lga")
    .eq("tenant_id", tenantId)
    .eq("assigned_agent_id", userId);
  if (assigned?.length) return assigned;
  const { data: all } = await supabase
    .from("polling_units")
    .select("id, code, name, ward, lga")
    .eq("tenant_id", tenantId)
    .order("name")
    .limit(50);
  return all ?? [];
}
