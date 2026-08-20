import { createClient } from "@/lib/supabase/server";
import { OUR_PARTY, type IncidentRow, type ResultRow, type StatusRow } from "@/lib/situation-room/race";

function one<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function normalizeJoin<T extends { profiles?: unknown; polling_units?: unknown }>(row: T): T {
  return {
    ...row,
    profiles: one(row.profiles as T["profiles"] | T["profiles"][] | null),
    polling_units: one(row.polling_units as T["polling_units"] | T["polling_units"][] | null),
  };
}

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
      .eq("tenant_id", tenantId)
      .order("updated_at", { ascending: false }),
    supabase
      .from("incident_reports")
      .select("*, polling_units(name, code, pu_code, ward, lga, latitude, longitude, registered_voters), profiles:reporter_id(full_name, phone, email)")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("election_results")
      .select("*, polling_units(name, code, pu_code, ward, lga, registered_voters, latitude, longitude), profiles:submitted_by(full_name, phone, email)")
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
  const resultRows = ((results ?? []) as ResultRow[]).map(normalizeJoin);
  const incidentRows = ((incidents ?? []) as IncidentRow[]).map(normalizeJoin);

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
    incidents: incidentRows,
    results: resultRows,
    agentReports: agentReports ?? [],
    wardTurnout: [...wardTurnout.entries()].map(([ward, v]) => ({ ward, ...v })),
  };
}
