"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  findNearestPollingUnits,
  searchPollingUnitsByCode,
  type AgentPollingUnit,
} from "@/lib/agent/actions";
import { toast } from "sonner";

function formatDistance(meters?: number | null) {
  if (meters == null || !Number.isFinite(meters)) return null;
  if (meters < 1000) return `${Math.round(meters)} m away`;
  return `${(meters / 1000).toFixed(1)} km away`;
}

function UnitButton({
  unit,
  selected,
  onSelect,
}: {
  unit: AgentPollingUnit;
  selected: boolean;
  onSelect: () => void;
}) {
  const dist = formatDistance(unit.distance_m);
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-md border px-3 py-2 text-left text-sm ${
        selected ? "border-primary bg-primary/10" : "border-border hover:bg-muted/60"
      }`}
    >
      <span className="font-medium">{unit.pu_code || unit.code}</span>
      <span className="text-muted-foreground"> — {unit.name}</span>
      <span className="mt-0.5 block text-xs text-muted-foreground">
        {unit.ward}, {unit.lga}
        {dist ? ` · ${dist}` : ""}
      </span>
    </button>
  );
}

export function PollingUnitPicker({
  assigned,
  selected,
  onSelect,
  coords,
  onCoords,
}: {
  assigned: AgentPollingUnit[];
  selected: AgentPollingUnit | null;
  onSelect: (unit: AgentPollingUnit, source: "gps" | "search" | "assigned") => void;
  coords: { lat: number; lng: number } | null;
  onCoords: (coords: { lat: number; lng: number }) => void;
}) {
  const [gpsStatus, setGpsStatus] = useState<"idle" | "locating" | "ready" | "denied">("idle");
  const [nearest, setNearest] = useState<AgentPollingUnit[]>([]);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<AgentPollingUnit[]>([]);
  const [pending, startTransition] = useTransition();

  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  function locate(force = false) {
    if (!navigator.geolocation) {
      setGpsStatus("denied");
      toast.error("GPS is not available on this device");
      return;
    }
    setGpsStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        onCoords(next);
        setGpsStatus("ready");
        startTransition(async () => {
          const units = await findNearestPollingUnits(next.lat, next.lng);
          setNearest(units);
          if (!units[0]) {
            toast.error("No polling unit with coordinates near this location. Search by PU code.");
            return;
          }
          if (force || !selectedRef.current) onSelect(units[0], "gps");
        });
      },
      () => {
        setGpsStatus("denied");
        toast.error("Allow location to pick the polling unit from GPS, or search by PU code");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    );
  }

  useEffect(() => {
    locate(false);
    // First GPS fix only; agents can tap Use GPS again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function search() {
    const q = query.trim();
    if (q.length < 2) {
      toast.error("Enter at least 2 characters of the PU code");
      return;
    }
    startTransition(async () => {
      const units = await searchPollingUnitsByCode(q);
      setHits(units);
      if (!units.length) {
        toast.error("No polling unit matches that code");
        return;
      }
      if (units.length === 1) onSelect(units[0], "search");
    });
  }

  return (
    <div className="space-y-3 rounded-xl border border-border p-4">
      <div>
        <Label>Polling unit</Label>
        <p className="text-xs text-muted-foreground">
          Uses your GPS position first. To choose another unit, search by PU code — every unit is
          available.
        </p>
      </div>

      <Button type="button" variant="outline" className="w-full" onClick={() => locate(true)} disabled={pending}>
        {gpsStatus === "locating"
          ? "Finding your position…"
          : coords
            ? `GPS ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)} — refresh`
            : "Use GPS to find polling unit"}
      </Button>

      {selected && (
        <div className="rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-sm">
          <p className="font-medium">
            Selected: {selected.pu_code || selected.code} — {selected.name}
          </p>
          <p className="text-xs text-muted-foreground">
            {selected.ward}, {selected.lga}
            {formatDistance(selected.distance_m) ? ` · ${formatDistance(selected.distance_m)}` : ""}
          </p>
        </div>
      )}

      {nearest.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Nearest to you</p>
          {nearest.map((u) => (
            <UnitButton
              key={u.id}
              unit={u}
              selected={selected?.id === u.id}
              onSelect={() => onSelect(u, "gps")}
            />
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          search();
        }}
        className="space-y-2"
      >
        <Label htmlFor="pu-code-search">Search by PU code</Label>
        <div className="flex gap-2">
          <Input
            id="pu-code-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. 12/03/005 or ED/…"
            autoComplete="off"
          />
          <Button type="submit" variant="secondary" disabled={pending}>
            Search
          </Button>
        </div>
      </form>

      {hits.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Search results</p>
          {hits.map((u) => (
            <UnitButton
              key={u.id}
              unit={u}
              selected={selected?.id === u.id}
              onSelect={() => onSelect(u, "search")}
            />
          ))}
        </div>
      )}

      {assigned.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Assigned to you</p>
          {assigned.map((u) => (
            <UnitButton
              key={u.id}
              unit={u}
              selected={selected?.id === u.id}
              onSelect={() => onSelect(u, "assigned")}
            />
          ))}
        </div>
      )}
    </div>
  );
}
