"use client";

import { useEffect, useState, useTransition } from "react";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { decodeWardValue } from "@/lib/agents/geo-encode";
import {
  getAgentRegistrationFocusState,
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
  initialPuId?: string;
  /** When true, only show unassigned polling units. */
  unassignedOnly?: boolean;
  onResolved?: (geo: {
    state: string;
    lga: string;
    ward: string;
    puCode: string;
    puId: string;
  }) => void;
};

export function AgentGeoCascade({
  disabled,
  initialState = "",
  initialWardValue = "",
  initialPuCode = "",
  initialPuId = "",
  unassignedOnly = true,
  onResolved,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [states, setStates] = useState<string[]>([]);
  const [wards, setWards] = useState<AgentWardOption[]>([]);
  const [units, setUnits] = useState<AgentPuOption[]>([]);
  const [state, setState] = useState(initialState);
  const [wardValue, setWardValue] = useState(initialWardValue);
  const [puId, setPuId] = useState(initialPuId);
  const [puCode, setPuCode] = useState(initialPuCode);

  useEffect(() => {
    startTransition(async () => {
      try {
        const [list, focus] = await Promise.all([
          getAgentRegistrationStates(),
          getAgentRegistrationFocusState(),
        ]);
        setStates(list);
        if (initialState) return;
        if (focus) {
          const match = list.find((s) => s.toLowerCase() === focus.toLowerCase());
          if (match) {
            setState(match);
            return;
          }
        }
        if (list.length === 1) setState(list[0]!);
      } catch (e) {
        console.error("[AgentGeoCascade] states", e);
        setStates([]);
      }
    });
  }, [initialState]);

  useEffect(() => {
    if (!state) {
      setWards([]);
      setWardValue("");
      setUnits([]);
      setPuId("");
      setPuCode("");
      return;
    }
    let cancelled = false;
    startTransition(async () => {
      try {
        const list = await getAgentRegistrationWards(state);
        if (cancelled) return;
        setWards(list);
        if (wardValue && !list.some((w) => w.value === wardValue)) {
          setWardValue("");
          setPuId("");
          setPuCode("");
          setUnits([]);
        }
      } catch (e) {
        console.error("[AgentGeoCascade] wards", e);
        if (!cancelled) setWards([]);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [state, wardValue]);

  useEffect(() => {
    if (!state || !wardValue) {
      setUnits([]);
      setPuId("");
      setPuCode("");
      return;
    }
    let cancelled = false;
    startTransition(async () => {
      try {
        const list = await getAgentRegistrationPollingUnits({
          state,
          wardValue,
          unassignedOnly,
        });
        if (cancelled) return;
        setUnits(list);
        const still = puId && list.some((u) => u.id === puId);
        if (still) {
          const match = list.find((u) => u.id === puId);
          setPuCode(match?.code ?? "");
        } else {
          setPuId("");
          setPuCode("");
        }
      } catch (e) {
        console.error("[AgentGeoCascade] polling units", e);
        if (!cancelled) {
          setUnits([]);
          setPuId("");
          setPuCode("");
        }
      }
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
      puId,
    });
  }, [state, wardValue, puCode, puId, onResolved]);

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
            setPuId("");
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
            setPuId("");
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
          name="polling_unit_id"
          required
          disabled={busy || !wardValue}
          value={puId}
          onChange={(e) => {
            const nextId = e.target.value;
            setPuId(nextId);
            setPuCode(units.find((u) => u.id === nextId)?.code ?? "");
          }}
        >
          <option value="">{wardValue ? "Select polling unit" : "Select ward first"}</option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.code}
              {u.name ? ` — ${u.name}` : ""}
              {u.assigned ? " (assigned)" : ""}
            </option>
          ))}
        </NativeSelect>
        <input type="hidden" name="pu_code" value={puCode} />
        {wardValue && units.length === 0 && !pending ? (
          <p className="text-xs text-muted-foreground">
            No {unassignedOnly ? "unassigned " : ""}polling units in this ward.
          </p>
        ) : null}
      </div>
    </div>
  );
}
