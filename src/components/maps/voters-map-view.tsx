"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { PageHeader } from "@/components/shared/page-shell";
import { GeoFilters } from "@/components/shared/geo-filters";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ExternalLink, X } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  getPollingUnitWards,
  queryPollingUnits,
  type PollingUnitListItem,
} from "@/lib/polling-units/actions";

const CampaignMap = dynamic(() => import("@/components/maps/campaign-map").then((m) => m.CampaignMap), {
  ssr: false,
  loading: () => <div className="h-[480px] animate-pulse rounded-xl bg-muted" />,
});

const LEGEND = [
  { status: "voting_in_progress", label: "Voting", color: "#22c55e" },
  { status: "voting_finished", label: "Voting finished", color: "#0d9488" },
  { status: "delayed", label: "Delayed", color: "#eab308" },
  { status: "minor_issue", label: "Minor issue", color: "#f97316" },
  { status: "serious_incident", label: "Incident", color: "#ef4444" },
  { status: "results_uploaded", label: "Results", color: "#3b82f6" },
  { status: "not_active", label: "Not active", color: "#94a3b8" },
];

const MAP_LIMIT = 400;

export function VotersMapView({ lgas }: { lgas: string[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [lga, setLga] = useState("");
  const [ward, setWard] = useState("");
  const [wards, setWards] = useState<string[]>([]);
  const [units, setUnits] = useState<PollingUnitListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (!lga) {
      setWards([]);
      return;
    }
    startTransition(async () => {
      setWards(await getPollingUnitWards(lga));
    });
  }, [lga]);

  const canQuery = Boolean(lga || ward || debouncedSearch.length >= 2);

  useEffect(() => {
    if (!canQuery) {
      setUnits([]);
      setTotal(0);
      setSelectedId(null);
      return;
    }
    startTransition(async () => {
      const result = await queryPollingUnits({
        lga,
        ward,
        search: debouncedSearch,
        page: 0,
        pageSize: MAP_LIMIT,
        mappedOnly: true,
      });
      setUnits(result.rows);
      setTotal(result.total);
    });
  }, [canQuery, lga, ward, debouncedSearch]);

  const selected = units.find((u) => u.id === selectedId);
  const handleMarkerClick = useCallback((id: string) => setSelectedId(id), []);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Voter Maps"
        description="Pick an LGA or search a PU code — pins are color-coded by live status"
      />

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
      </div>

      <div className="flex flex-wrap gap-3 text-xs">
        {LEGEND.map((item) => (
          <span key={item.status} className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded-full" style={{ background: item.color }} />
            {item.label}
          </span>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <CampaignMap
            markers={units.map((u) => ({
              id: u.id,
              lat: u.latitude!,
              lng: u.longitude!,
              label: u.name,
              sublabel: u.code,
              status: u.live_status,
            }))}
            height={480}
            cluster={units.length > 15}
            selectedId={selectedId ?? undefined}
            onMarkerClick={handleMarkerClick}
            emptyHint={
              canQuery
                ? pending
                  ? "Finding polling units…"
                  : "No mapped units match that search."
                : "Select an LGA or search a PU code to drop pins."
            }
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
                <p className="text-sm">
                  {selected.ward}, {selected.lga}, {selected.state}
                </p>
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
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Directions
                    </a>
                  </Button>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full"
                  onClick={() => router.push(`/polling-units/${selected.id}`)}
                >
                  View full details
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {canQuery
                  ? `${units.length.toLocaleString()} on the map${total > units.length ? ` of ${total.toLocaleString()} matches — narrow by ward or search` : ""}.`
                  : "Click a marker after you filter or search."}
              </p>
            )}
            <div className="mt-4 space-y-2 border-t border-border pt-4">
              {units.slice(0, 12).map((u) => (
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
