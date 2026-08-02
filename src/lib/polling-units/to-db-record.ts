import type { NormalizedPollingUnit } from "@/lib/polling-units/csv";

export function pollingUnitToDbRecord(tenantId: string, row: NormalizedPollingUnit) {
  return {
    tenant_id: tenantId,
    code: row.code,
    name: row.name,
    ward: row.ward,
    lga: row.lga,
    state: row.state,
    state_code: row.state_code,
    lg_code: row.lg_code,
    ward_code: row.ward_code,
    pu_code: row.pu_code,
    registered_voters: row.registered_voters,
    latitude: row.latitude,
    longitude: row.longitude,
    address: row.address,
    geocode_status: row.latitude && row.longitude ? "done" : "pending",
    risk_level: "low" as const,
  };
}
