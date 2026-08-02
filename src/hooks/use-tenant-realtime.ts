"use client";

import { useCallback, useRef } from "react";
import { useRealtime } from "@/hooks/use-realtime";

export function useTenantRealtime<T extends Record<string, unknown>>(
  table: string,
  tenantId: string,
  onChange: () => void
) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const handler = useCallback(
    () => {
      onChangeRef.current();
    },
    []
  );

  const { connected } = useRealtime<T>(
    table,
    tenantId ? { column: "tenant_id", value: tenantId } : undefined,
    tenantId ? handler : undefined
  );

  return { connected };
}

export function usePollingUnitStatusRealtime(tenantId: string, onChange: () => void) {
  return useTenantRealtime("polling_unit_status", tenantId, onChange);
}

export function useIncidentsRealtime(tenantId: string, onChange: () => void) {
  return useTenantRealtime("incident_reports", tenantId, onChange);
}

export function useElectionResultsRealtime(tenantId: string, onChange: () => void) {
  return useTenantRealtime("election_results", tenantId, onChange);
}

export function useCommentsRealtime(tenantId: string, onChange: () => void) {
  return useTenantRealtime("comments", tenantId, onChange);
}
