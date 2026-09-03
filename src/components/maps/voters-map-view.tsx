"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
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
import { PU_STATUS_VALUES } from "@/lib/agent/pu-status";
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

function normKey(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ");
}

function countStatuses(pins: FieldMapPin[]): FieldStatusCounts {
  const counts = emptyCounts();
  for (const pin of pins) {
    const key = (PU_STATUS_VALUES as readonly string[]).includes(pin.live_status)
      ? (pin.live_status as keyof FieldStatusCounts)
      : "not_active";
    counts[key] += 1;
  }
  return counts;
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
  /** Full statewide pin set — LGA/ward filter is applied client-side so slow refetches cannot wipe the filter. */
  const [allPins, setAllPins] = useState<FieldMapPin[]>(initial.pins);
  const [mappedUnits, setMappedUnits] = useState(initial.mappedUnits);
  const [totalUnits, setTotalUnits] = useState(initial.totalUnits);
  const [activeStatuses, setActiveStatuses] = useState<Set<string>>(() => new Set(DEFAULT_ACTIVE));
  const [showInactive, setShowInactive] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [liveTick, setLiveTick] = useState(0);
  const [pinning, setPinning] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const refreshSeq = useRef(0);
  const skipFirstLiveFetch = useRef(initial.pins.length > 0);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  async function dropApproxPins() {
    setPinning(true);
    try {
      let totalPinned = 0;
      let lastRemaining: number | null = null;
      for (let i = 0; i < 40; i += 1) {
        const res = await fetch("/api/polling-units/geocode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ approx: true, limit: 250 }),
        });
        const raw = await res.text();
        let data: {
          error?: string;
          geocoded?: number;
          remaining?: number;
          mapped?: number;
          total?: number;
        } = {};
        try {
          data = raw ? (JSON.parse(raw) as typeof data) : {};
        } catch {
          toast.error(res.ok ? "Pin fill returned an invalid response" : `Pin fill failed (HTTP ${res.status})`);
          return;
        }
        if (!res.ok) {
          toast.error(data.error || `Pin fill failed (HTTP ${res.status})`);
          return;
        }
        totalPinned += data.geocoded ?? 0;
        lastRemaining = data.remaining ?? 0;
        if (typeof data.mapped === "number") setMappedUnits(data.mapped);
        if (typeof data.total === "number") setTotalUnits(data.total);
        if (!(data.remaining ?? 0) || !(data.geocoded ?? 0)) break;
      }
      if (totalPinned > 0) {
        toast.success(
          `Pinned ${totalPinned.toLocaleString()} polling units` +
            (lastRemaining ? ` · ${lastRemaining.toLocaleString()} still open` : "")
        );
      } else {
        toast.message(lastRemaining ? "No pins written — check permissions / service role key" : "Pins already complete");
      }
      setLiveTick((n) => n + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Pin fill failed");
    } finally {
      setPinning(false);
    }
  }

  async function alignInecGps() {
    setPinning(true);
    try {
      let totalAligned = 0;
      let lastRemainingApprox: number | null = null;
      let catalog = 0;
      let offset = 0;
      for (let i = 0; i < 80; i += 1) {
        const res = await fetch("/api/polling-units/geocode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ inec: true, force: true, limit: 300, offset }),
        });
        const raw = await res.text();
        let data: {
          error?: string;
          geocoded?: number;
          remaining?: number;
          remainingApprox?: number;
          mapped?: number;
          total?: number;
          catalog?: number;
          nextOffset?: number;
        } = {};
        try {
          data = raw ? (JSON.parse(raw) as typeof data) : {};
        } catch {
          toast.error(res.ok ? "INEC align returned an invalid response" : `INEC align failed (HTTP ${res.status})`);
          return;
        }
        if (!res.ok) {
          toast.error(data.error || `INEC align failed (HTTP ${res.status})`);
          return;
        }
        totalAligned += data.geocoded ?? 0;
        lastRemainingApprox = data.remainingApprox ?? lastRemainingApprox;
        catalog = data.catalog ?? catalog;
        offset = data.nextOffset ?? offset;
        if (typeof data.mapped === "number") setMappedUnits(data.mapped);
        if (typeof data.total === "number") setTotalUnits(data.total);
        if (!(data.remaining ?? 0)) break;
      }
      if (totalAligned > 0) {
        toast.success(
          `Aligned ${totalAligned.toLocaleString()} pins to INEC GPS` +
            (catalog ? ` · catalog ${catalog.toLocaleString()}` : "") +
            (lastRemainingApprox ? ` · ${lastRemainingApprox.toLocaleString()} still approx` : "")
        );
      } else {
        toast.message(
          catalog
            ? lastRemainingApprox
              ? "Catalog applied — some units still need INEC GPS (npm run pu:fetch-gps -- --resume)"
              : "Pins already match INEC GPS"
            : "INEC GPS catalog missing — run npm run pu:fetch-gps"
        );
      }
      setLiveTick((n) => n + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "INEC align failed");
    } finally {
      setPinning(false);
    }
  }

  useEffect(() => {
    if (!lga) {
      setWards([]);
      return;
    }
    let cancelled = false;
    startTransition(async () => {
      const next = await getPollingUnitWards(lga);
      if (!cancelled) setWards(next);
    });
    return () => {
      cancelled = true;
    };
  }, [lga]);

  // Refresh the full pin catalog on live status changes (never keyed by LGA/ward).
  useEffect(() => {
    if (skipFirstLiveFetch.current && liveTick === 0) {
      skipFirstLiveFetch.current = false;
      return;
    }
    const seq = ++refreshSeq.current;
    setRefreshing(true);
    startTransition(async () => {
      try {
        const data = await getFieldStatusMapData();
        if (seq !== refreshSeq.current) return;
        setAllPins(data.pins);
        setMappedUnits(data.mappedUnits);
        setTotalUnits(data.totalUnits);
      } finally {
        if (seq === refreshSeq.current) setRefreshing(false);
      }
    });
  }, [liveTick]);

  usePollingUnitStatusRealtime(initial.tenantId, () => {
    setLiveTick((n) => n + 1);
  });

  const geoFocused = Boolean(lga || ward || debouncedSearch.length >= 2);
  const focusToken = `${lga}|${ward}|${debouncedSearch}`;

  const filteredPins = useMemo(() => {
    const lgaKey = lga ? normKey(lga) : "";
    const wardKey = ward ? normKey(ward) : "";
    const q = debouncedSearch.length >= 2 ? debouncedSearch.toLowerCase() : "";
    return allPins.filter((p) => {
      if (lgaKey && normKey(p.lga) !== lgaKey) return false;
      if (wardKey && normKey(p.ward) !== wardKey) return false;
      if (q) {
        const hay = `${p.code} ${p.name} ${p.ward} ${p.lga}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allPins, lga, ward, debouncedSearch]);

  const counts = useMemo(() => countStatuses(filteredPins), [filteredPins]);

  const visiblePins = useMemo(() => {
    return filteredPins.filter((p) => {
      // LGA / ward / search must show the units in that area (usually not_active).
      if (geoFocused) return true;
      if (p.live_status === "not_active") return showInactive;
      return activeStatuses.has(p.live_status);
    });
  }, [filteredPins, activeStatuses, showInactive, geoFocused]);

  // When a ward (or LGA with few units) loads, jump to the first matching PU.
  useEffect(() => {
    if (!geoFocused) return;
    if (visiblePins.length === 0) {
      setSelectedId(null);
      return;
    }
    if (ward || visiblePins.length === 1) {
      setSelectedId((prev) => {
        if (prev && visiblePins.some((p) => p.id === prev)) return prev;
        return visiblePins[0].id;
      });
      return;
    }
    // LGA-only: clear stale selection outside the LGA, keep if still valid.
    setSelectedId((prev) => (prev && visiblePins.some((p) => p.id === prev) ? prev : null));
  }, [geoFocused, ward, visiblePins]);

  const selected = allPins.find((u) => u.id === selectedId) ?? visiblePins.find((u) => u.id === selectedId);
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
        <Button type="button" variant="default" size="sm" disabled={pinning} onClick={alignInecGps}>
          <MapPin className="mr-2 h-4 w-4" />
          {pinning ? "Aligning…" : "Align to INEC GPS"}
        </Button>
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
            focusToken={focusToken}
            onMarkerClick={handleMarkerClick}
            emptyHint={
              allPins.length === 0 && refreshing
                ? "Loading polling units…"
                : mappedUnits === 0
                  ? "No coordinates yet — run npm run pu:pins (or geocode) for this tenant."
                  : geoFocused
                    ? "No mapped units in that LGA / ward. Try another filter or pin missing units."
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
                {geoFocused
                  ? `${visiblePins.length.toLocaleString()} unit${visiblePins.length === 1 ? "" : "s"} in this LGA/ward. Pick a ward to jump to a PU, or click a pin.`
                  : `${visiblePins.length.toLocaleString()} pin${visiblePins.length === 1 ? "" : "s"} on the map. Click a marker or a unit below. Toggle status chips to focus Voting / Delayed / Incident / Results.`}
              </p>
            )}

            <div className="mt-4 space-y-2 border-t border-border pt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {geoFocused ? "Units in this area" : "Active field units"}
              </p>
              {(geoFocused ? visiblePins : visiblePins.filter((u) => u.live_status !== "not_active"))
                .slice(0, 40)
                .map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    className={cn(
                      "block w-full rounded-lg border p-2 text-left text-sm hover:bg-muted",
                      selectedId === u.id ? "border-primary bg-muted" : "border-border"
                    )}
                    onClick={() => setSelectedId(u.id)}
                  >
                    <span className="font-medium">{u.code}</span>
                    <span className="text-muted-foreground"> — {labelForStatus(u.live_status)}</span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">{u.name}</span>
                  </button>
                ))}
              {!geoFocused && !visiblePins.some((u) => u.live_status !== "not_active") && (
                <p className="text-xs text-muted-foreground">
                  No live field statuses yet. Choose an LGA/ward to zoom to polling units, or wait for agent updates.
                </p>
              )}
              {geoFocused && visiblePins.length === 0 && (
                <p className="text-xs text-muted-foreground">No mapped units for that filter.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
