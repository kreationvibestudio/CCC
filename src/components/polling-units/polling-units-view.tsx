"use client";

import dynamic from "next/dynamic";
import { PageHeader, StatCard } from "@/components/shared/page-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const CampaignMap = dynamic(() => import("@/components/maps/campaign-map").then((m) => m.CampaignMap), {
  ssr: false,
  loading: () => <div className="h-64 animate-pulse rounded-xl bg-muted" />,
});

type PU = {
  id: string;
  name: string;
  code: string;
  ward: string;
  lga: string;
  state: string;
  registered_voters: number | null;
  latitude: number | null;
  longitude: number | null;
  risk_level: string | null;
};

export function PollingUnitsView({ units }: { units: PU[] }) {
  const withCoords = units.filter((u) => u.latitude && u.longitude);
  return (
    <div className="space-y-6">
      <PageHeader title="Polling Units" description="Constituency polling unit database" />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Total PUs" value={units.length} />
        <StatCard title="Mapped" value={withCoords.length} />
        <StatCard title="Registered Voters" value={units.reduce((s, u) => s + (u.registered_voters ?? 0), 0).toLocaleString()} />
      </div>
      {withCoords.length > 0 && (
        <CampaignMap
          markers={withCoords.map((u) => ({
            id: u.id,
            lat: u.latitude!,
            lng: u.longitude!,
            label: u.name,
            sublabel: `${u.ward}, ${u.lga}`,
          }))}
        />
      )}
      <div className="grid gap-2">
        {units.map((u) => (
          <Card key={u.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div>
                <p className="font-medium">{u.name}</p>
                <p className="text-xs text-muted-foreground">{u.code} · {u.ward}, {u.lga}, {u.state}</p>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline">{(u.registered_voters ?? 0).toLocaleString()} voters</Badge>
                {u.risk_level && <Badge variant={u.risk_level === "high" ? "destructive" : "secondary"}>{u.risk_level}</Badge>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
