"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";
import { withDisplayCode } from "@/lib/polling-units/code";
import { pollingUnitSearchOrFilter } from "@/lib/polling-units/lookup";
import { applyCampaignStateFilter } from "@/lib/polling-units/scope";
import { PU_STATUS_VALUES } from "@/lib/agent/pu-status";

const MAP_COLS =
  "id, name, code, pu_code, ward, lga, state, registered_voters, latitude, longitude, state_code, ward_code, lg_code";

type PollingUnitListItemLike = {
  id: string;
  name?: string | null;
  code?: string | null;
  pu_code?: string | null;
  ward?: string | null;
  lga?: string | null;
  state?: string | null;
  registered_voters?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  state_code?: string | null;
  ward_code?: string | null;
  lg_code?: string | null;
};

function sanitizeFilter(raw: string) {
  return raw.trim().slice(0, 64).replace(/[%_,()"]/g, "");
}

export type FieldMapPin = {
  id: string;
  name: string;
  code: string;
  ward: string;
  lga: string;
  state: string;
  registered_voters: number;
  latitude: number;
  longitude: number;
  live_status: string;
  turnout: number;
};

export type FieldStatusCounts = Record<(typeof PU_STATUS_VALUES)[number], number>;

function emptyCounts(): FieldStatusCounts {
  return {
    not_active: 0,
    voting_in_progress: 0,
    voting_finished: 0,
    delayed: 0,
    minor_issue: 0,
    serious_incident: 0,
    results_uploaded: 0,
  };
}

export async function getFieldStatusMapData(input?: {
  lga?: string;
  ward?: string;
  search?: string;
}): Promise<{
  pins: FieldMapPin[];
  counts: FieldStatusCounts;
  totalUnits: number;
  mappedUnits: number;
  tenantId: string;
}> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      pins: [],
      counts: emptyCounts(),
      totalUnits: 0,
      mappedUnits: 0,
      tenantId: "",
    };
  }

  const tenantId = user.profile.tenant_id;
  const lga = sanitizeFilter(input?.lga ?? "");
  const ward = sanitizeFilter(input?.ward ?? "");
  const search = sanitizeFilter(input?.search ?? "");
  const supabase = await createClient();

  const [{ count: totalUnits }, { count: mappedUnits }, statusRes] = await Promise.all([
    applyCampaignStateFilter(
      supabase.from("polling_units").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId)
    ),
    applyCampaignStateFilter(
      supabase
        .from("polling_units")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .not("latitude", "is", null)
        .not("longitude", "is", null)
    ),
    supabase
      .from("polling_unit_status")
      .select("polling_unit_id, status, turnout")
      .eq("tenant_id", tenantId),
  ]);

  const statusMap = new Map(
    (statusRes.data ?? []).map((s) => [
      s.polling_unit_id as string,
      { status: String(s.status ?? "not_active"), turnout: Number(s.turnout ?? 0) },
    ])
  );

  const pins: FieldMapPin[] = [];
  const pageSize = 1000;
  for (let from = 0; from < 20000; from += pageSize) {
    let q = applyCampaignStateFilter(
      supabase.from("polling_units").select(MAP_COLS).eq("tenant_id", tenantId)
    )
      .not("latitude", "is", null)
      .not("longitude", "is", null)
      .order("code")
      .range(from, from + pageSize - 1);

    if (lga) q = q.eq("lga", lga);
    if (ward) q = q.eq("ward", ward);
    if (search.length >= 2) q = q.or(pollingUnitSearchOrFilter(search));

    const { data, error } = await q;
    if (error || !data?.length) break;

    for (const row of data) {
      const raw = row as PollingUnitListItemLike;
      const unit = withDisplayCode({
        code: String(raw.code ?? ""),
        state_code: raw.state_code,
        lg_code: raw.lg_code,
        ward_code: raw.ward_code,
        pu_code: raw.pu_code,
      });
      const lat = Number(raw.latitude);
      const lng = Number(raw.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      const st = statusMap.get(raw.id);
      pins.push({
        id: raw.id,
        name: String(raw.name ?? ""),
        code: unit.code,
        ward: String(raw.ward ?? ""),
        lga: String(raw.lga ?? ""),
        state: String(raw.state ?? ""),
        registered_voters: Number(raw.registered_voters ?? 0),
        latitude: lat,
        longitude: lng,
        live_status: st?.status ?? "not_active",
        turnout: st?.turnout ?? 0,
      });
    }
    if (data.length < pageSize) break;
  }

  const counts = emptyCounts();
  for (const pin of pins) {
    const key = (PU_STATUS_VALUES as readonly string[]).includes(pin.live_status)
      ? (pin.live_status as keyof FieldStatusCounts)
      : "not_active";
    counts[key] += 1;
  }

  return {
    pins,
    counts,
    totalUnits: totalUnits ?? 0,
    mappedUnits: mappedUnits ?? 0,
    tenantId,
  };
}
