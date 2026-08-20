"use client";

import { useCallback, useRef } from "react";
import { useRealtime } from "@/hooks/use-realtime";

export function useTenantRealtime<T extends Record<string, unknown>>(
  table: string,
  tenantId: string,
  onChange: (payload?: { eventType: string; new: T; old: T }) => void
) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const handler = useCallback(
    (payload: { eventType: string; new: T; old: T }) => {
      onChangeRef.current(payload);
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

type RtHandler = (payload?: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }) => void;

export function usePollingUnitStatusRealtime(tenantId: string, onChange: RtHandler) {
  return useTenantRealtime("polling_unit_status", tenantId, onChange);
}

export function useIncidentsRealtime(tenantId: string, onChange: RtHandler) {
  return useTenantRealtime("incident_reports", tenantId, onChange);
}

export function useElectionResultsRealtime(tenantId: string, onChange: RtHandler) {
  return useTenantRealtime("election_results", tenantId, onChange);
}

export function useAgentReportsRealtime(tenantId: string, onChange: RtHandler) {
  return useTenantRealtime("agent_reports", tenantId, onChange);
}

export function useCommentsRealtime(tenantId: string, onChange: RtHandler) {
  return useTenantRealtime("comments", tenantId, onChange);
}
