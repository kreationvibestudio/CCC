"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { ExternalLink, MapPin, Radio, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-shell";
import { GeoFilters } from "@/components/shared/geo-filters";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { usePollingUnitStatusRealtime } from "@/hooks/use-tenant-realtime";
import { getPollingUnitWards } from "@/lib/polling-units/actions";
import {
  getFieldStatusMapData,
  type FieldMapPin,
  type FieldStatusCounts,
} from "@/lib/maps/field-status";
import { cn } from "@/lib/utils";

const CampaignMap = dynamic(() => import("@/components/maps/campaign-map").then((m) => m.CampaignMap), {
  ssr: false,
  loading: () => <div className="h-[560px] animate-pulse rounded-xl bg-muted" />,
});

/** Primary election-day statuses the map is built to show. */
export const FIELD_STATUS_LEGEND = [
  { status: "voting_in_progress", label: "Voting", color: "#22c55e" },
  { status: "voting_finished", label: "Voting finished", color: "#0d9488" },
  { status: "delayed", label: "Delayed", color: "#eab308" },
  { status: "minor_issue", label: "Minor issue", color: "#f97316" },
  { status: "serious_incident", label: "Incident", color: "#ef4444" },
  { status: "results_uploaded", label: "Results", color: "#3b82f6" },
] as const;

const OPTIONAL_STATUS = { status: "not_active", label: "Not active", color: "#94a3b8" } as const;

const DEFAULT_ACTIVE = new Set(FIELD_STATUS_LEGEND.map((s) => s.status));

function labelForStatus(status: string) {
  const hit = [...FIELD_STATUS_LEGEND, OPTIONAL_STATUS].find((s) => s.status === status);
  return hit?.label ?? status.replace(/_/g, " ");
}

export function VotersMapView({
  lgas,
  initial,
}: {
  lgas: string[];
  initial: Awaited<ReturnType<typeof getFieldStatusMapData>>;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [lga, setLga] = useState("");
  const [ward, setWard] = useState("");
  const [wards, setWards] = useState<string[]>([]);
  const [pins, setPins] = useState<FieldMapPin[]>(initial.pins);
  const [counts, setCounts] = useState<FieldStatusCounts>(initial.counts);
  const [mappedUnits, setMappedUnits] = useState(initial.mappedUnits);
  const [totalUnits, setTotalUnits] = useState(initial.totalUnits);
  const [activeStatuses, setActiveStatuses] = useState<Set<string>>(() => new Set(DEFAULT_ACTIVE));
  const [showInactive, setShowInactive] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [liveTick, setLiveTick] = useState(0);

  const [pinning, setPinning] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  async function dropApproxPins() {
    setPinning(true);
    try {
      let totalPinned = 0;
      for (let i = 0; i < 20; i += 1) {
        const res = await fetch("/api/polling-units/geocode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ approx: true, limit: 500 }),
        });
        const data = (await res.json()) as { error?: string; geocoded?: number; remaining?: number };
        if (!res.ok) {
          toast.error(data.error || "Could not drop map pins");
          break;
        }
        totalPinned += data.geocoded ?? 0;
        if (!(data.remaining ?? 0) || !(data.geocoded ?? 0)) break;
      }
      toast.success(totalPinned ? `Pinned ${totalPinned.toLocaleString()} polling units` : "Pins already complete");
      setLiveTick((n) => n + 1);
    } catch {
      toast.error("Pin fill failed");
    } finally {
      setPinning(false);
    }
  }

  useEffect(() => {
    if (!lga) {
      setWards([]);
      return;
    }
    startTransition(async () => {
      setWards(await getPollingUnitWards(lga));
    });
  }, [lga]);

  const reload = useCallback(() => {
    startTransition(async () => {
      const data = await getFieldStatusMapData({
        lga,
        ward,
        search: debouncedSearch,
      });
      setPins(data.pins);
      setCounts(data.counts);
      setMappedUnits(data.mappedUnits);
      setTotalUnits(data.totalUnits);
    });
  }, [lga, ward, debouncedSearch]);

  useEffect(() => {
    reload();
  }, [reload, liveTick]);

  usePollingUnitStatusRealtime(initial.tenantId, () => {
    setLiveTick((n) => n + 1);
  });

  const visiblePins = useMemo(() => {
    return pins.filter((p) => {
      if (p.live_status === "not_active") return showInactive;
      return activeStatuses.has(p.live_status);
    });
  }, [pins, activeStatuses, showInactive]);

  const selected = pins.find((u) => u.id === selectedId) ?? visiblePins.find((u) => u.id === selectedId);
  const handleMarkerClick = useCallback((id: string) => setSelectedId(id), []);

  function toggleStatus(status: string) {
    setActiveStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  }

  const activeFieldCount = FIELD_STATUS_LEGEND.reduce((sum, s) => sum + (counts[s.status] ?? 0), 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Field Status Map"
        description="Live polling-unit pins — Voting, finished, delayed, issues, incidents, and results"
      >
        <p className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm">
          <Radio className="h-4 w-4 text-emerald-500" />
          <span>
            <span className="font-medium">{mappedUnits.toLocaleString()}</span>
            <span className="text-muted-foreground"> / {totalUnits.toLocaleString()} PUs mapped</span>
            {activeFieldCount > 0 ? (
              <span className="text-muted-foreground"> · {activeFieldCount.toLocaleString()} live field signals</span>
            ) : null}
          </span>
        </p>
      </PageHeader>

      <div className="flex flex-wrap gap-2">
        {FIELD_STATUS_LEGEND.map((item) => {
          const on = activeStatuses.has(item.status);
          const n = counts[item.status] ?? 0;
          return (
            <button
              key={item.status}
              type="button"
              onClick={() => toggleStatus(item.status)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                on ? "border-transparent text-white" : "border-border bg-card text-muted-foreground opacity-60"
              )}
              style={on ? { background: item.color } : undefined}
              aria-pressed={on}
            >
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-white/90" style={!on ? { background: item.color } : undefined} />
              {item.label}
              <span className={cn("tabular-nums", on ? "text-white/90" : "")}>{n}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setShowInactive((v) => !v)}
          className={cn(
            "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium",
            showInactive ? "border-slate-400 bg-slate-500 text-white" : "border-border bg-card text-muted-foreground"
          )}
          aria-pressed={showInactive}
        >
          {OPTIONAL_STATUS.label}
          <span className="tabular-nums">{counts.not_active}</span>
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search PU code or name…"
          className="max-w-xs"
        />
        <GeoFilters
          lgas={lgas.map((name) => ({ value: name, label: name }))}
          wards={wards.map((name) => ({ value: name, label: name }))}
          lga={lga}
          ward={ward}
          onLgaChange={(next) => {
            setLga(next);
            setWard("");
          }}
          onWardChange={setWard}
        />
        {(lga || ward || debouncedSearch) && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setLga("");
              setWard("");
              setSearch("");
            }}
          >
            Clear filters
          </Button>
        )}
        {mappedUnits < totalUnits ? (
          <Button type="button" variant="secondary" size="sm" disabled={pinning} onClick={dropApproxPins}>
            <MapPin className="mr-2 h-4 w-4" />
            {pinning ? "Pinning…" : `Pin ${(totalUnits - mappedUnits).toLocaleString()} missing`}
          </Button>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <CampaignMap
            markers={visiblePins.map((u) => ({
              id: u.id,
              lat: u.latitude,
              lng: u.longitude,
              label: u.name,
              sublabel: `${u.code} · ${labelForStatus(u.live_status)}`,
              status: u.live_status,
            }))}
            height={560}
            cluster={visiblePins.length > 20}
            selectedId={selectedId ?? undefined}
            onMarkerClick={handleMarkerClick}
            emptyHint={
              pending
                ? "Loading polling units…"
                : mappedUnits === 0
                  ? "No coordinates yet — run npm run pu:pins (or geocode) for this tenant."
                  : "No pins match the selected statuses / filters."
            }
          />
        </div>

        <Card className="h-[560px] overflow-y-auto">
          <CardContent className="p-4">
            {selected ? (
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{selected.name}</p>
                    <p className="text-xs text-muted-foreground">{selected.code}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedId(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-sm">
                  {selected.ward}, {selected.lga}, {selected.state}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge>{selected.registered_voters.toLocaleString()} voters</Badge>
                  <Badge
                    style={{
                      background:
                        FIELD_STATUS_LEGEND.find((s) => s.status === selected.live_status)?.color ??
                        OPTIONAL_STATUS.color,
                      color: "#fff",
                    }}
                  >
                    {labelForStatus(selected.live_status)}
                  </Badge>
                  {selected.turnout > 0 && <Badge variant="outline">{selected.turnout} turnout</Badge>}
                </div>
                <Button variant="outline" size="sm" asChild>
                  <a
                    href={`https://maps.google.com/?q=${selected.latitude},${selected.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Directions
                  </a>
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full"
                  onClick={() => router.push(`/polling-units/${selected.id}`)}
                >
                  View full details
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => router.push("/situation-room")}
                >
                  Open Situation Room
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {visiblePins.length.toLocaleString()} pin{visiblePins.length === 1 ? "" : "s"} on the map.
                Click a marker or a unit below. Toggle status chips to focus Voting / Delayed / Incident /
                Results.
              </p>
            )}

            <div className="mt-4 space-y-2 border-t border-border pt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Active field units
              </p>
              {visiblePins
                .filter((u) => u.live_status !== "not_active")
                .slice(0, 40)
                .map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    className="block w-full rounded-lg border border-border p-2 text-left text-sm hover:bg-muted"
                    onClick={() => setSelectedId(u.id)}
                  >
                    <span className="font-medium">{u.code}</span>
                    <span className="text-muted-foreground"> — {labelForStatus(u.live_status)}</span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">{u.name}</span>
                  </button>
                ))}
              {!visiblePins.some((u) => u.live_status !== "not_active") && (
                <p className="text-xs text-muted-foreground">
                  No live field statuses yet. Agents update these from the Agent Portal / Situation Room.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
