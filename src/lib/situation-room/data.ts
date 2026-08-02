import { createClient } from "@/lib/supabase/server";

export async function getSituationRoomData(tenantId: string) {
  const supabase = await createClient();
  const [
    { data: statuses },
    { data: incidents },
    { data: results },
    { data: agentReports },
    { data: units },
  ] = await Promise.all([
    supabase.from("polling_unit_status").select("*, polling_units(name, ward, lga, latitude, longitude, registered_voters, code)").eq("tenant_id", tenantId),
    supabase.from("incident_reports").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(30),
    supabase.from("election_results").select("*, polling_units(name, code)").eq("tenant_id", tenantId).order("submitted_at", { ascending: false }).limit(20),
    supabase.from("agent_reports").select("*, profiles(full_name)").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(20),
    supabase.from("polling_units").select("ward, registered_voters").eq("tenant_id", tenantId),
  ]);

  const wardTurnout = new Map<string, { turnout: number; registered: number }>();
  for (const s of statuses ?? []) {
    const ward = (s.polling_units as { ward?: string })?.ward ?? "Unknown";
    const reg = (s.polling_units as { registered_voters?: number })?.registered_voters ?? 0;
    const cur = wardTurnout.get(ward) ?? { turnout: 0, registered: 0 };
    cur.turnout += s.turnout ?? 0;
    cur.registered += reg;
    wardTurnout.set(ward, cur);
  }

  return {
    statuses: statuses ?? [],
    incidents: incidents ?? [],
    results: results ?? [],
    agentReports: agentReports ?? [],
    wardTurnout: [...wardTurnout.entries()].map(([ward, v]) => ({ ward, ...v })),
  };
}
