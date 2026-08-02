"use client";

import { useMemo, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { PageHeader } from "@/components/shared/page-shell";
import { GeoFilters } from "@/components/shared/geo-filters";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ExternalLink, X } from "lucide-react";
import { useRouter } from "next/navigation";

const CampaignMap = dynamic(() => import("@/components/maps/campaign-map").then((m) => m.CampaignMap), {
  ssr: false,
  loading: () => <div className="h-[480px] animate-pulse rounded-xl bg-muted" />,
});

type PU = {
  id: string;
  name: string;
  code: string;
  pu_code?: string | null;
  ward: string;
  lga: string;
  state: string;
  registered_voters: number | null;
  latitude: number | null;
  longitude: number | null;
  risk_level: string | null;
  address?: string | null;
  live_status?: string;
  turnout?: number;
};

const LEGEND = [
  { status: "voting_in_progress", label: "Voting", color: "#22c55e" },
  { status: "delayed", label: "Delayed", color: "#eab308" },
  { status: "minor_issue", label: "Minor issue", color: "#f97316" },
  { status: "serious_incident", label: "Incident", color: "#ef4444" },
  { status: "results_uploaded", label: "Results", color: "#3b82f6" },
  { status: "not_active", label: "Not active", color: "#94a3b8" },
];

export function VotersMapView({ units, lgas }: { units: PU[]; lgas: string[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [lga, setLga] = useState("");
  const [ward, setWard] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const wards = useMemo(() => {
    const src = lga ? units.filter((u) => u.lga === lga) : units;
    return [...new Set(src.map((u) => u.ward))].sort();
  }, [units, lga]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return units.filter((u) => {
      if (lga && u.lga !== lga) return false;
      if (ward && u.ward !== ward) return false;
      if (
        q &&
        !u.code.toLowerCase().includes(q) &&
        !(u.pu_code ?? "").toLowerCase().includes(q) &&
        !u.name.toLowerCase().includes(q) &&
        !u.ward.toLowerCase().includes(q)
      )
        return false;
      return u.latitude && u.longitude;
    });
  }, [units, lga, ward, search]);

  const selected = units.find((u) => u.id === selectedId);

  const handleMarkerClick = useCallback((id: string) => setSelectedId(id), []);

  return (
    <div className="space-y-4">
      <PageHeader title="Voter Maps" description="Search polling units across Edo/Esan — color-coded by live status" />

      <div className="flex flex-wrap gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search PU code, name, or ward…"
          className="max-w-xs"
        />
        <GeoFilters
          lgas={lgas.map((l) => ({ value: l, label: l }))}
          wards={wards.map((w) => ({ value: w, label: w }))}
          lga={lga}
          ward={ward}
          onLgaChange={setLga}
          onWardChange={setWard}
        />
      </div>

      <div className="flex flex-wrap gap-3 text-xs">
        {LEGEND.map((l) => (
          <span key={l.status} className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded-full" style={{ background: l.color }} />
            {l.label}
          </span>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <CampaignMap
            markers={filtered.map((u) => ({
              id: u.id,
              lat: u.latitude!,
              lng: u.longitude!,
              label: u.name,
              sublabel: u.code,
              status: u.live_status,
            }))}
            height={480}
            cluster={filtered.length > 15}
            selectedId={selectedId ?? undefined}
            onMarkerClick={handleMarkerClick}
          />
        </div>

        <Card className="h-[480px] overflow-y-auto">
          <CardContent className="p-4">
            {selected ? (
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold">{selected.name}</p>
                    <p className="text-xs text-muted-foreground">{selected.code}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedId(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-sm">{selected.ward}, {selected.lga}, {selected.state}</p>
                {selected.address && <p className="text-xs text-muted-foreground">{selected.address}</p>}
                <div className="flex flex-wrap gap-2">
                  <Badge>{(selected.registered_voters ?? 0).toLocaleString()} voters</Badge>
                  <Badge variant="secondary">{(selected.live_status ?? "not_active").replace(/_/g, " ")}</Badge>
                  {selected.turnout != null && selected.turnout > 0 && (
                    <Badge variant="outline">{selected.turnout} turnout</Badge>
                  )}
                </div>
                {selected.latitude && selected.longitude && (
                  <Button variant="outline" size="sm" asChild>
                    <a
                      href={`https://maps.google.com/?q=${selected.latitude},${selected.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />Directions
                    </a>
                  </Button>
                )}
                <Button variant="secondary" size="sm" className="w-full" onClick={() => router.push(`/polling-units/${selected.id}`)}>
                  View full details
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Click a marker or search for a polling unit. {filtered.length} units on map.
              </p>
            )}
            <div className="mt-4 space-y-2 border-t border-border pt-4">
              {search &&
                filtered.slice(0, 8).map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    className="block w-full rounded-lg border border-border p-2 text-left text-sm hover:bg-muted"
                    onClick={() => setSelectedId(u.id)}
                  >
                    <span className="font-medium">{u.code}</span> — {u.name}
                  </button>
                ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
