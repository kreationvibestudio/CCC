import { createClient } from "@/lib/supabase/server";
import { OUR_PARTY, type ResultRow, type StatusRow } from "@/lib/situation-room/race";

async function universeStats(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string
) {
  const [{ count }, rpc] = await Promise.all([
    supabase.from("polling_units").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
    supabase.rpc("election_universe_stats"),
  ]);

  const payload = rpc.data as { pu_count?: number; registered_voters?: number } | null;
  return {
    puCount: Number(payload?.pu_count ?? count ?? 0),
    registeredVoters: Number(payload?.registered_voters ?? 0),
  };
}

export async function getSituationRoomData(tenantId: string) {
  const supabase = await createClient();
  const [
    universe,
    partySetting,
    { data: statuses },
    { data: incidents },
    { data: results },
    { data: agentReports },
  ] = await Promise.all([
    universeStats(supabase, tenantId),
    supabase
      .from("tenant_settings")
      .select("value")
      .eq("tenant_id", tenantId)
      .eq("key", "campaign_party")
      .maybeSingle(),
    supabase
      .from("polling_unit_status")
      .select("*, polling_units(name, ward, lga, latitude, longitude, registered_voters, code)")
      .eq("tenant_id", tenantId),
    supabase
      .from("incident_reports")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("election_results")
      .select("*, polling_units(name, code, ward, lga, registered_voters)")
      .eq("tenant_id", tenantId)
      .order("submitted_at", { ascending: false })
      .limit(3000),
    supabase
      .from("agent_reports")
      .select("*, profiles(full_name)")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(40),
  ]);

  const settingVal = partySetting.data?.value;
  const ourParty =
    typeof settingVal === "string"
      ? settingVal
      : settingVal && typeof settingVal === "object" && "party" in settingVal
        ? String((settingVal as { party: string }).party)
        : OUR_PARTY;

  const statusRows = (statuses ?? []) as StatusRow[];
  const resultRows = (results ?? []) as ResultRow[];

  const wardTurnout = new Map<string, { turnout: number; registered: number }>();
  for (const s of statusRows) {
    const ward = s.polling_units?.ward ?? "Unknown";
    const reg = s.polling_units?.registered_voters ?? 0;
    const cur = wardTurnout.get(ward) ?? { turnout: 0, registered: 0 };
    cur.turnout += s.turnout ?? 0;
    cur.registered += reg;
    wardTurnout.set(ward, cur);
  }

  return {
    ourParty: ourParty.toUpperCase(),
    universe,
    statuses: statusRows,
    incidents: incidents ?? [],
    results: resultRows,
    agentReports: agentReports ?? [],
    wardTurnout: [...wardTurnout.entries()].map(([ward, v]) => ({ ward, ...v })),
  };
}
