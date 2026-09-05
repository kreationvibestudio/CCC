"use server";

import { revalidatePath } from "next/cache";
import { requirePermission, logAudit } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/admin";
import { fetchAllRows } from "@/lib/supabase/paginate";

export type SituationRoomResetResult = {
  success?: true;
  error?: string;
  message?: string;
  cleared?: {
    incidents: number;
    results: number;
    reports: number;
    statuses: number;
  };
};

/**
 * Clear only Situation Room live data for this tenant.
 * Does not touch polling units, users, CRM, volunteers, or settings.
 */
export async function resetSituationRoomData(): Promise<SituationRoomResetResult> {
  try {
    const user = await requirePermission("situation_room.manage");
    const admin = createServiceClient();
    const tenantId = user.profile.tenant_id;

    const rpc = await admin.rpc("zero_situation_room_data", { p_tenant_id: tenantId });
    if (!rpc.error) {
      const data = (rpc.data ?? {}) as {
        incident_reports?: number;
        election_results?: number;
        agent_reports?: number;
        polling_unit_status?: number;
      };
      const cleared = {
        incidents: Number(data.incident_reports ?? 0),
        results: Number(data.election_results ?? 0),
        reports: Number(data.agent_reports ?? 0),
        statuses: Number(data.polling_unit_status ?? 0),
      };
      await logAudit("situation_room.reset", "tenant", tenantId, cleared);
      revalidatePath("/situation-room");
      revalidatePath("/maps");
      revalidatePath("/analytics");
      revalidatePath("/dashboard");
      const total = cleared.incidents + cleared.results + cleared.reports + cleared.statuses;
      return {
        success: true,
        cleared,
        message:
          total === 0
            ? "Situation Room was already empty."
            : `Situation Room reset — cleared ${cleared.results} results, ${cleared.incidents} incidents, ${cleared.statuses} statuses, ${cleared.reports} reports.`,
      };
    }

    // Fallback if migration not applied yet — delete tables directly.
    if (!/could not find the function|schema cache/i.test(rpc.error.message)) {
      return { error: rpc.error.message };
    }

    // Paged: a single select stops at PostgREST's row cap, which would leave
    // media rows pointing at incidents that are about to be deleted.
    const incidentIds = await fetchAllRows<{ id: string }>(
      (from, to) =>
        admin.from("incident_reports").select("id").eq("tenant_id", tenantId).order("id").range(from, to),
      { max: 200_000 }
    );
    for (let i = 0; i < incidentIds.length; i += 500) {
      const slice = incidentIds.slice(i, i + 500).map((r) => r.id);
      const { error } = await admin.from("incident_media").delete().in("incident_id", slice);
      if (error) return { error: `incident_media: ${error.message}` };
    }

    const counts = { incidents: 0, results: 0, reports: 0, statuses: 0 };
    for (const [key, table] of [
      ["incidents", "incident_reports"],
      ["results", "election_results"],
      ["reports", "agent_reports"],
      ["statuses", "polling_unit_status"],
    ] as const) {
      const { count } = await admin
        .from(table)
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId);
      counts[key] = count ?? 0;
      const { error } = await admin.from(table).delete().eq("tenant_id", tenantId);
      if (error) return { error: `${table}: ${error.message}` };
    }

    await logAudit("situation_room.reset", "tenant", tenantId, counts);
    revalidatePath("/situation-room");
    revalidatePath("/maps");
    revalidatePath("/analytics");
    revalidatePath("/dashboard");
    const total = counts.incidents + counts.results + counts.reports + counts.statuses;
    return {
      success: true,
      cleared: counts,
      message:
        total === 0
          ? "Situation Room was already empty."
          : `Situation Room reset — cleared ${counts.results} results, ${counts.incidents} incidents, ${counts.statuses} statuses, ${counts.reports} reports.`,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not reset Situation Room" };
  }
}
