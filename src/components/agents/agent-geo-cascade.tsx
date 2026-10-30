"use client";

import { useEffect, useState, useTransition } from "react";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { decodeWardValue } from "@/lib/agents/geo-encode";
import {
  getAgentRegistrationPollingUnits,
  getAgentRegistrationStates,
  getAgentRegistrationWards,
  type AgentPuOption,
  type AgentWardOption,
} from "@/lib/agents/geo-options";

type Props = {
  disabled?: boolean;
  initialState?: string;
  initialWardValue?: string;
  initialPuCode?: string;
  /** When true, only show unassigned polling units. */
  unassignedOnly?: boolean;
  onResolved?: (geo: {
    state: string;
    lga: string;
    ward: string;
    puCode: string;
  }) => void;
};

export function AgentGeoCascade({
  disabled,
  initialState = "",
  initialWardValue = "",
  initialPuCode = "",
  unassignedOnly = true,
  onResolved,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [states, setStates] = useState<string[]>([]);
  const [wards, setWards] = useState<AgentWardOption[]>([]);
  const [units, setUnits] = useState<AgentPuOption[]>([]);
  const [state, setState] = useState(initialState);
  const [wardValue, setWardValue] = useState(initialWardValue);
  const [puCode, setPuCode] = useState(initialPuCode);

  useEffect(() => {
    startTransition(async () => {
      const list = await getAgentRegistrationStates();
      setStates(list);
      if (!initialState && list.length === 1) {
        setState(list[0]);
      }
    });
  }, [initialState]);

  useEffect(() => {
    if (!state) {
      setWards([]);
      setWardValue("");
      setUnits([]);
      setPuCode("");
      return;
    }
    let cancelled = false;
    startTransition(async () => {
      const list = await getAgentRegistrationWards(state);
      if (cancelled) return;
      setWards(list);
      if (wardValue && !list.some((w) => w.value === wardValue)) {
        setWardValue("");
        setPuCode("");
        setUnits([]);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [state, wardValue]);

  useEffect(() => {
    if (!state || !wardValue) {
      setUnits([]);
      setPuCode("");
      return;
    }
    let cancelled = false;
    startTransition(async () => {
      const list = await getAgentRegistrationPollingUnits({
        state,
        wardValue,
        unassignedOnly,
      });
      if (cancelled) return;
      setUnits(list);
      setPuCode((current) => (current && list.some((u) => u.code === current) ? current : ""));
    });
    return () => {
      cancelled = true;
    };
  }, [state, wardValue, unassignedOnly]);

  useEffect(() => {
    const decoded = decodeWardValue(wardValue);
    onResolved?.({
      state,
      lga: decoded?.lga ?? "",
      ward: decoded?.ward ?? "",
      puCode,
    });
  }, [state, wardValue, puCode, onResolved]);

  const busy = disabled || pending;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:col-span-2">
      <div className="space-y-1">
        <Label htmlFor="agent_state">State</Label>
        <NativeSelect
          id="agent_state"
          name="state"
          required
          disabled={busy}
          value={state}
          onChange={(e) => {
            setState(e.target.value);
            setWardValue("");
            setPuCode("");
            setUnits([]);
          }}
        >
          <option value="">Select state</option>
          {states.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="space-y-1">
        <Label htmlFor="agent_ward">Ward</Label>
        <NativeSelect
          id="agent_ward"
          name="ward_value"
          required
          disabled={busy || !state}
          value={wardValue}
          onChange={(e) => {
            setWardValue(e.target.value);
            setPuCode("");
          }}
        >
          <option value="">{state ? "Select ward" : "Select state first"}</option>
          {wards.map((w) => (
            <option key={w.value} value={w.value}>
              {w.label}
            </option>
          ))}
        </NativeSelect>
        <input type="hidden" name="ward" value={decodeWardValue(wardValue)?.ward ?? ""} />
        <input type="hidden" name="lga" value={decodeWardValue(wardValue)?.lga ?? ""} />
      </div>
      <div className="space-y-1 sm:col-span-2">
        <Label htmlFor="agent_pu">Polling unit</Label>
        <NativeSelect
          id="agent_pu"
          name="pu_code"
          required
          disabled={busy || !wardValue}
          value={puCode}
          onChange={(e) => setPuCode(e.target.value)}
        >
          <option value="">{wardValue ? "Select polling unit" : "Select ward first"}</option>
          {units.map((u) => (
            <option key={u.id} value={u.code}>
              {u.code}
              {u.name ? ` — ${u.name}` : ""}
              {u.assigned ? " (assigned)" : ""}
            </option>
          ))}
        </NativeSelect>
        {wardValue && units.length === 0 && !pending ? (
          <p className="text-xs text-muted-foreground">
            No {unassignedOnly ? "unassigned " : ""}polling units in this ward.
          </p>
        ) : null}
      </div>
    </div>
  );
}
