"use client";

import { useEffect, useState, useTransition } from "react";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  getMemberRegistrationFocusState,
  getMemberRegistrationLgas,
  getMemberRegistrationPollingUnits,
  getMemberRegistrationStates,
  getMemberRegistrationWards,
  type MemberPuOption,
} from "@/lib/members/geo-options";
import {
  getPublicMemberLgas,
  getPublicMemberPollingUnits,
  getPublicMemberStates,
  getPublicMemberWards,
} from "@/lib/members/public-geo";

type Props = {
  disabled?: boolean;
  /** Public signup form cannot rely on HQ session permissions. */
  publicMode?: boolean;
  initialState?: string;
  initialLga?: string;
  initialWard?: string;
  initialPuId?: string;
};

export function MemberGeoCascade({
  disabled,
  publicMode = false,
  initialState = "",
  initialLga = "",
  initialWard = "",
  initialPuId = "",
}: Props) {
  const [pending, startTransition] = useTransition();
  const [states, setStates] = useState<string[]>([]);
  const [lgas, setLgas] = useState<string[]>([]);
  const [wards, setWards] = useState<string[]>([]);
  const [units, setUnits] = useState<MemberPuOption[]>([]);
  const [state, setState] = useState(initialState);
  const [lga, setLga] = useState(initialLga);
  const [ward, setWard] = useState(initialWard);
  const [puId, setPuId] = useState(initialPuId);
  const [puCode, setPuCode] = useState("");
  const [puName, setPuName] = useState("");

  useEffect(() => {
    startTransition(async () => {
      try {
        if (publicMode) {
          const list = await getPublicMemberStates();
          setStates(list);
          if (!initialState && list.length === 1) setState(list[0]!);
          return;
        }
        const [list, focus] = await Promise.all([
          getMemberRegistrationStates(),
          getMemberRegistrationFocusState(),
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
        console.error("[MemberGeoCascade] states", e);
        setStates([]);
      }
    });
  }, [initialState, publicMode]);

  useEffect(() => {
    if (!state) {
      setLgas([]);
      setLga("");
      setWards([]);
      setWard("");
      setUnits([]);
      setPuId("");
      setPuCode("");
      setPuName("");
      return;
    }
    let cancelled = false;
    startTransition(async () => {
      try {
        const list = publicMode
          ? await getPublicMemberLgas(state)
          : await getMemberRegistrationLgas(state);
        if (cancelled) return;
        setLgas(list);
        if (lga && !list.some((item) => item === lga)) {
          setLga("");
          setWard("");
          setWards([]);
          setUnits([]);
          setPuId("");
          setPuCode("");
          setPuName("");
        }
      } catch (e) {
        console.error("[MemberGeoCascade] lgas", e);
        if (!cancelled) setLgas([]);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [state, lga, publicMode]);

  useEffect(() => {
    if (!state || !lga) {
      setWards([]);
      setWard("");
      setUnits([]);
      setPuId("");
      setPuCode("");
      setPuName("");
      return;
    }
    let cancelled = false;
    startTransition(async () => {
      try {
        const list = publicMode
          ? await getPublicMemberWards(state, lga)
          : await getMemberRegistrationWards(state, lga);
        if (cancelled) return;
        setWards(list);
        if (ward && !list.includes(ward)) {
          setWard("");
          setUnits([]);
          setPuId("");
          setPuCode("");
          setPuName("");
        }
      } catch (e) {
        console.error("[MemberGeoCascade] wards", e);
        if (!cancelled) setWards([]);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [state, lga, ward, publicMode]);

  useEffect(() => {
    if (!state || !lga || !ward) {
      setUnits([]);
      setPuId("");
      setPuCode("");
      setPuName("");
      return;
    }
    let cancelled = false;
    startTransition(async () => {
      try {
        const list = publicMode
          ? await getPublicMemberPollingUnits({ state, lga, ward })
          : await getMemberRegistrationPollingUnits({ state, lga, ward });
        if (cancelled) return;
        setUnits(list);
        const still = puId && list.some((u) => u.id === puId);
        if (still) {
          const match = list.find((u) => u.id === puId);
          setPuCode(match?.code ?? "");
          setPuName(match?.name ?? "");
        } else {
          setPuId("");
          setPuCode("");
          setPuName("");
        }
      } catch (e) {
        console.error("[MemberGeoCascade] units", e);
        if (!cancelled) {
          setUnits([]);
          setPuId("");
          setPuCode("");
          setPuName("");
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, [state, lga, ward, puId, publicMode]);

  const busy = disabled || pending;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:col-span-2">
      <div className="space-y-1">
        <Label htmlFor="member_state">State</Label>
        <NativeSelect
          id="member_state"
          name="state"
          required
          disabled={busy}
          value={state}
          onChange={(e) => {
            setState(e.target.value);
            setLga("");
            setWard("");
            setPuId("");
            setPuCode("");
            setPuName("");
            setLgas([]);
            setWards([]);
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
        <Label htmlFor="member_lga">LGA</Label>
        <NativeSelect
          id="member_lga"
          name="lga"
          required
          disabled={busy || !state}
          value={lga}
          onChange={(e) => {
            setLga(e.target.value);
            setWard("");
            setPuId("");
            setPuCode("");
            setPuName("");
            setWards([]);
            setUnits([]);
          }}
        >
          <option value="">{state ? "Select LGA" : "Select state first"}</option>
          {lgas.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="space-y-1">
        <Label htmlFor="member_ward">Ward</Label>
        <NativeSelect
          id="member_ward"
          name="ward"
          required
          disabled={busy || !lga}
          value={ward}
          onChange={(e) => {
            setWard(e.target.value);
            setPuId("");
            setPuCode("");
            setPuName("");
            setUnits([]);
          }}
        >
          <option value="">{lga ? "Select ward" : "Select LGA first"}</option>
          {wards.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="space-y-1">
        <Label htmlFor="member_unit">Unit (polling unit)</Label>
        <NativeSelect
          id="member_unit"
          name="polling_unit_id"
          required
          disabled={busy || !ward}
          value={puId}
          onChange={(e) => {
            const nextId = e.target.value;
            const match = units.find((u) => u.id === nextId);
            setPuId(nextId);
            setPuCode(match?.code ?? "");
            setPuName(match?.name ?? "");
          }}
        >
          <option value="">{ward ? "Select unit" : "Select ward first"}</option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.code}
              {u.name ? ` — ${u.name}` : ""}
            </option>
          ))}
        </NativeSelect>
        <input type="hidden" name="unit_code" value={puCode} />
        <input type="hidden" name="unit_name" value={puName} />
        {ward && units.length === 0 && !pending ? (
          <p className="text-xs text-muted-foreground">No polling units found in this ward.</p>
        ) : null}
      </div>
    </div>
  );
}
