"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth/session";
import { parsePartyVotes, totalPartyVotes } from "@/lib/elections/parties";
import { parsePollingUnitStatus } from "@/lib/agent/pu-status";
import { assertPollingUnitInTenant } from "@/lib/tenancy";

/** User session for auth; service role for writes so missing INSERT policies cannot block agents. */
async function agentDb() {
  try {
    return createServiceClient();
  } catch {
    return createClient();
  }
}

function revalidateAgent() {
  revalidatePath("/agent");
  revalidatePath("/situation-room");
}

function capturedAtIso(formData: FormData) {
  const raw = String(formData.get("captured_at") ?? "").trim();
  const parsed = raw ? new Date(raw) : new Date();
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString();
  return parsed.toISOString();
}

export async function submitAgentReport(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized" };
  const content = String(formData.get("content") ?? "").trim();
  const reportType = String(formData.get("report_type") ?? "").trim();
  if (!content || !reportType) return { error: "Report type and details are required" };
  const capturedAt = capturedAtIso(formData);
  const puId = (formData.get("polling_unit_id") as string) || null;
  const puError = await assertPollingUnitInTenant(user.profile.tenant_id, puId);
  if (puError) return { error: puError };
  const supabase = await agentDb();
  const { data, error } = await supabase.from("agent_reports").insert({
    tenant_id: user.profile.tenant_id,
    agent_id: user.id,
    report_type: reportType,
    content,
    polling_unit_id: puId,
    created_at: capturedAt,
  }).select("id").single();
  if (error) return { error: error.message };
  revalidateAgent();
  return { success: true as const, id: data?.id as string | undefined };
}

export async function reportIncident(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized" };
  const puId = (formData.get("polling_unit_id") as string) || null;
  const puError = await assertPollingUnitInTenant(user.profile.tenant_id, puId);
  if (puError) return { error: puError };
  const supabase = await agentDb();
  const capturedAt = capturedAtIso(formData);
  const { data, error } = await supabase.from("incident_reports").insert({
    tenant_id: user.profile.tenant_id,
    reporter_id: user.id,
    polling_unit_id: puId,
    title: formData.get("title") as string,
    description: formData.get("description") as string,
    severity: (formData.get("severity") as string) || "medium",
    is_emergency: formData.get("is_emergency") === "true",
    latitude: formData.get("latitude") ? Number(formData.get("latitude")) : null,
    longitude: formData.get("longitude") ? Number(formData.get("longitude")) : null,
    created_at: capturedAt,
  }).select("id").single();
  if (error) return { error: error.message };
  const mediaUrl = String(formData.get("media_url") ?? "").trim();
  if (data?.id && mediaUrl) {
    await supabase.from("incident_media").insert({
      incident_id: data.id,
      media_type: "photo",
      url: mediaUrl,
    });
  }
  revalidateAgent();
  return { success: true as const, id: data?.id as string | undefined };
}

export async function updatePuStatus(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized" };
  const supabase = await agentDb();
  const puId = String(formData.get("polling_unit_id") ?? "").trim();
  if (!puId) return { error: "Select a polling unit" };
  const puError = await assertPollingUnitInTenant(user.profile.tenant_id, puId);
  if (puError) return { error: puError };
  const capturedAt = capturedAtIso(formData);
  const status = parsePollingUnitStatus(String(formData.get("status") ?? ""));
  if (!status) return { error: "Select a valid PU status" };
  const { error } = await supabase.from("polling_unit_status").upsert({
    tenant_id: user.profile.tenant_id,
    polling_unit_id: puId,
    status,
    turnout: formData.get("turnout") ? Number(formData.get("turnout")) : 0,
    updated_by: user.id,
    updated_at: capturedAt,
  }, { onConflict: "tenant_id,polling_unit_id" });
  if (error) return { error: error.message };
  revalidateAgent();
  return { success: true };
}

export async function submitElectionResult(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized" };
  const puId = String(formData.get("polling_unit_id") ?? "").trim();
  if (!puId) return { error: "Select a polling unit" };
  const puError = await assertPollingUnitInTenant(user.profile.tenant_id, puId);
  if (puError) return { error: puError };

  let parsed: unknown = {};
  try {
    parsed = JSON.parse(String(formData.get("party_votes") ?? "{}"));
  } catch {
    parsed = {};
  }
  const partyVotes = parsePartyVotes(parsed);
  const total = totalPartyVotes(partyVotes);
  if (total < 0) return { error: "Vote counts cannot be negative" };

  const supabase = await agentDb();
  const capturedAt = capturedAtIso(formData);
  const sheetUrl = String(formData.get("result_sheet_url") ?? "").trim() || null;
  const { data, error } = await supabase.from("election_results").insert({
    tenant_id: user.profile.tenant_id,
    polling_unit_id: puId,
    submitted_by: user.id,
    party_votes: partyVotes,
    total_votes: total,
    result_sheet_url: sheetUrl,
    latitude: formData.get("latitude") ? Number(formData.get("latitude")) : null,
    longitude: formData.get("longitude") ? Number(formData.get("longitude")) : null,
    submitted_at: capturedAt,
  }).select("id").single();
  if (error) return { error: error.message };
  await supabase.from("polling_unit_status").upsert({
    tenant_id: user.profile.tenant_id,
    polling_unit_id: puId,
    status: "results_uploaded",
    updated_by: user.id,
    updated_at: capturedAt,
  }, { onConflict: "tenant_id,polling_unit_id" });
  revalidateAgent();
  return { success: true as const, id: data?.id as string | undefined };
}

export type AgentPollingUnit = {
  id: string;
  code: string;
  pu_code: string | null;
  name: string;
  ward: string;
  lga: string;
  latitude: number | null;
  longitude: number | null;
  distance_m?: number | null;
};

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(a));
}

function sanitizePuQuery(raw: string) {
  return raw.trim().slice(0, 48).replace(/[%_,()]/g, "");
}

export async function findNearestPollingUnits(lat: number, lng: number): Promise<AgentPollingUnit[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];

  const supabase = await createClient();
  const rpc = await supabase.rpc("nearest_polling_units", {
    p_lat: lat,
    p_lng: lng,
    p_limit: 8,
    p_radius_km: 8,
  });

  if (!rpc.error && Array.isArray(rpc.data) && rpc.data.length) {
    return (rpc.data as AgentPollingUnit[]).map((row) => ({
      ...row,
      distance_m: row.distance_m != null ? Number(row.distance_m) : null,
    }));
  }

  const tenantId = user.profile.tenant_id;
  for (const km of [2, 8, 25]) {
    const dLat = km / 111.32;
    const dLng = km / (111.32 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
    const { data, error } = await supabase
      .from("polling_units")
      .select("id, code, pu_code, name, ward, lga, latitude, longitude")
      .eq("tenant_id", tenantId)
      .not("latitude", "is", null)
      .not("longitude", "is", null)
      .gte("latitude", lat - dLat)
      .lte("latitude", lat + dLat)
      .gte("longitude", lng - dLng)
      .lte("longitude", lng + dLng)
      .limit(80);
    if (error || !data?.length) continue;
    return (data as AgentPollingUnit[])
      .map((row) => ({
        ...row,
        distance_m: haversineMeters(lat, lng, Number(row.latitude), Number(row.longitude)),
      }))
      .sort((a, b) => (a.distance_m ?? 0) - (b.distance_m ?? 0))
      .slice(0, 8);
  }
  return [];
}

export async function searchPollingUnitsByCode(query: string): Promise<AgentPollingUnit[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  const q = sanitizePuQuery(query);
  if (q.length < 2) return [];

  const supabase = await createClient();
  const tenantId = user.profile.tenant_id;
  const cols = "id, code, pu_code, name, ward, lga, latitude, longitude";

  async function match(column: "code" | "pu_code", pattern: string) {
    const { data } = await supabase
      .from("polling_units")
      .select(cols)
      .eq("tenant_id", tenantId)
      .ilike(column, pattern)
      .order(column)
      .limit(20);
    return (data ?? []) as AgentPollingUnit[];
  }

  const map = new Map<string, AgentPollingUnit>();
  const add = (rows: AgentPollingUnit[]) => {
    for (const row of rows) map.set(row.id, row);
  };

  add((await Promise.all([match("code", `${q}%`), match("pu_code", `${q}%`)])).flat());
  if (map.size < 15) {
    add((await Promise.all([match("code", `%${q}%`), match("pu_code", `%${q}%`)])).flat());
  }

  const qLower = q.toLowerCase();
  return [...map.values()]
    .sort((a, b) => {
      const score = (u: AgentPollingUnit) => {
        const code = u.code.toLowerCase();
        const pu = (u.pu_code ?? "").toLowerCase();
        if (code === qLower || pu === qLower) return 0;
        if (code.startsWith(qLower) || pu.startsWith(qLower)) return 1;
        return 2;
      };
      const diff = score(a) - score(b);
      return diff !== 0 ? diff : a.code.localeCompare(b.code);
    })
    .slice(0, 25);
}

export async function getAssignedPollingUnits(userId: string, tenantId: string): Promise<AgentPollingUnit[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("polling_units")
    .select("id, code, pu_code, name, ward, lga, latitude, longitude")
    .eq("tenant_id", tenantId)
    .eq("assigned_agent_id", userId)
    .order("code")
    .limit(40);
  return (data ?? []) as AgentPollingUnit[];
}
