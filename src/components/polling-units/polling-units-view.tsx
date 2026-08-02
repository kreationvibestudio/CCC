"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { PageHeader, StatCard } from "@/components/shared/page-shell";
import { GeoFilters } from "@/components/shared/geo-filters";
import { DataTable } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ExternalLink, Plus, Upload } from "lucide-react";
import { importPollingUnitsCsv } from "@/lib/polling-units/actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

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
  live_status?: string;
  turnout?: number;
  geocode_status?: string | null;
};

export function PollingUnitsView({ units, lgas }: { units: PU[]; lgas: string[] }) {
  const router = useRouter();
  const [lga, setLga] = useState("");
  const [ward, setWard] = useState("");
  const [importing, setImporting] = useState(false);

  const wards = useMemo(() => {
    const src = lga ? units.filter((u) => u.lga === lga) : units;
    return [...new Set(src.map((u) => u.ward))].sort();
  }, [units, lga]);

  const filtered = useMemo(() => {
    return units.filter((u) => {
      if (lga && u.lga !== lga) return false;
      if (ward && u.ward !== ward) return false;
      return true;
    });
  }, [units, lga, ward]);

  const withCoords = filtered.filter((u) => u.latitude && u.longitude);

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    const text = await file.text();
    const result = await importPollingUnitsCsv(text);
    setImporting(false);
    if (result.error) toast.error(result.error);
    else {
      toast.success(`Imported ${result.imported} polling units`);
      router.refresh();
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Polling Units" description="Edo/Esan constituency polling unit database">
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <label className="cursor-pointer">
              <Upload className="mr-2 h-4 w-4" />
              {importing ? "Importing…" : "Import CSV"}
              <input type="file" accept=".csv" className="hidden" onChange={handleImport} disabled={importing} />
            </label>
          </Button>
          <Button asChild>
            <Link href="/polling-units/new"><Plus className="mr-2 h-4 w-4" />Add PU</Link>
          </Button>
        </div>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard title="Total PUs" value={filtered.length} />
        <StatCard title="Mapped" value={withCoords.length} />
        <StatCard title="Registered Voters" value={filtered.reduce((s, u) => s + (u.registered_voters ?? 0), 0).toLocaleString()} />
        <StatCard title="Voting Active" value={filtered.filter((u) => u.live_status === "voting_in_progress").length} />
      </div>

      <GeoFilters
        lgas={lgas.map((l) => ({ value: l, label: l }))}
        wards={wards.map((w) => ({ value: w, label: w }))}
        lga={lga}
        ward={ward}
        onLgaChange={setLga}
        onWardChange={setWard}
      />

      {withCoords.length > 0 && (
        <CampaignMap
          markers={withCoords.map((u) => ({
            id: u.id,
            lat: u.latitude!,
            lng: u.longitude!,
            label: u.name,
            sublabel: `${u.code} · ${u.ward}`,
            status: u.live_status,
          }))}
          height={280}
          cluster={withCoords.length > 20}
        />
      )}

      <DataTable
        data={filtered}
        searchKeys={["code", "name", "ward", "lga"]}
        searchPlaceholder="Search by code, name, ward…"
        onRowClick={(row) => router.push(`/polling-units/${row.id}`)}
        columns={[
          { key: "code", header: "Code" },
          { key: "name", header: "Name" },
          { key: "ward", header: "Ward" },
          { key: "lga", header: "LGA" },
          {
            key: "registered_voters",
            header: "Voters",
            render: (u) => (u.registered_voters ?? 0).toLocaleString(),
          },
          {
            key: "live_status",
            header: "Status",
            render: (u) => (
              <Badge variant="secondary">{(u.live_status ?? "not_active").replace(/_/g, " ")}</Badge>
            ),
          },
          {
            key: "risk_level",
            header: "Risk",
            render: (u) => u.risk_level && <Badge variant={u.risk_level === "high" ? "destructive" : "outline"}>{u.risk_level}</Badge>,
          },
        ]}
      />
    </div>
  );
}
