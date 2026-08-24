"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { PageHeader, StatCard } from "@/components/shared/page-shell";
import { GeoFilters } from "@/components/shared/geo-filters";
import { DataTable } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Upload } from "lucide-react";
import { GeocodePinsButton } from "@/components/polling-units/geocode-pins-button";
import { FormatPuCodesButton } from "@/components/polling-units/format-pu-codes-button";
import { SyncInecRegisterButton } from "@/components/polling-units/sync-inec-button";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { parsePollingUnitsCsv } from "@/lib/polling-units/csv";
import { importPollingUnitsClient } from "@/lib/polling-units/import-client";
import {
  getPollingUnitWards,
  queryPollingUnits,
  type PollingUnitListItem,
  type PollingUnitSummary,
} from "@/lib/polling-units/actions";

const CampaignMap = dynamic(() => import("@/components/maps/campaign-map").then((m) => m.CampaignMap), {
  ssr: false,
  loading: () => <div className="h-64 animate-pulse rounded-xl bg-muted" />,
});

const PAGE_SIZE = 40;

export function PollingUnitsView({
  lgas,
  summary,
  votingActive,
  tenantId,
}: {
  lgas: string[];
  summary: PollingUnitSummary;
  votingActive: number;
  tenantId: string;
}) {
  const router = useRouter();
  const [lga, setLga] = useState("");
  const [ward, setWard] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);
  const [wards, setWards] = useState<string[]>([]);
  const [rows, setRows] = useState<PollingUnitListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [pending, startTransition] = useTransition();
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState("");

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
    setPage(0);
  }, [lga, ward, debouncedSearch]);

  useEffect(() => {
    if (!canQuery) {
      setRows([]);
      setTotal(0);
      return;
    }
    startTransition(async () => {
      const result = await queryPollingUnits({
        lga,
        ward,
        search: debouncedSearch,
        page,
        pageSize: PAGE_SIZE,
      });
      setRows(result.rows);
      setTotal(result.total);
    });
  }, [canQuery, lga, ward, debouncedSearch, page]);

  const withCoords = useMemo(() => rows.filter((u) => u.latitude && u.longitude), [rows]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportProgress("");
    try {
      const parsed = parsePollingUnitsCsv(await file.text());
      if (parsed.length === 0) {
        toast.error("No valid rows found in CSV");
        return;
      }
      const { imported, failed } = await importPollingUnitsClient(
        tenantId,
        parsed,
        (done, all) => setImportProgress(`${done}/${all}`)
      );
      if (imported === 0 && failed > 0) {
        toast.error(`Import failed — ${failed} rows rejected. Check database migration is applied.`);
        return;
      }
      toast.success(`Imported ${imported} polling units${failed ? ` (${failed} failed)` : ""}`);
      router.refresh();
    } catch {
      toast.error("Import failed — check your connection and try again");
    } finally {
      setImporting(false);
      setImportProgress("");
      e.target.value = "";
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Polling Units" description="Search the full register by LGA, ward, or PU code">
        <div className="flex flex-wrap gap-2">
          <SyncInecRegisterButton />
          <FormatPuCodesButton />
          <GeocodePinsButton mapped={summary.mapped} total={summary.puCount} />
          <Button variant="outline" asChild>
            <Link href="/polling-units/agents">Assign agents</Link>
          </Button>
          <Button variant="outline" asChild>
            <label className="cursor-pointer">
              <Upload className="mr-2 h-4 w-4" />
              {importing ? (importProgress ? `Importing ${importProgress}…` : "Importing…") : "Import CSV"}
              <input type="file" accept=".csv" className="hidden" onChange={handleImport} disabled={importing} />
            </label>
          </Button>
          <Button asChild>
            <Link href="/polling-units/new">
              <Plus className="mr-2 h-4 w-4" />
              Add PU
            </Link>
          </Button>
        </div>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard title="Total PUs" value={summary.puCount.toLocaleString()} />
        <StatCard title="Mapped" value={`${summary.mapped.toLocaleString()} / ${summary.puCount.toLocaleString()}`} />
        <StatCard title="Registered Voters" value={summary.registeredVoters.toLocaleString()} />
        <StatCard title="Voting Active" value={votingActive.toLocaleString()} />
      </div>

      <div className="flex flex-wrap items-end gap-3">
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
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="FCT/AMAC/04/028, 37/06/04/028, or name…"
          className="max-w-xs"
        />
      </div>

      {!canQuery ? (
        <p className="text-sm text-muted-foreground">
          Select an LGA or type at least 2 characters of a PU code. Loading every unit at once would freeze the page.
        </p>
      ) : pending && rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Loading polling units…</p>
      ) : (
        <>
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
          <p className="text-xs text-muted-foreground">
            {total.toLocaleString()} matching units · page {page + 1} of {totalPages}
            {pending ? " · updating…" : ""}
          </p>
          <DataTable
            data={rows}
            pageSize={PAGE_SIZE}
            emptyMessage="No polling units match those filters."
            onRowClick={(row) => router.push(`/polling-units/${row.id}`)}
            columns={[
              { key: "code", header: "Code", render: (u) => <span className="font-mono">{u.code}</span> },
              { key: "pu_code", header: "PU" },
              { key: "name", header: "Location" },
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
                key: "latitude",
                header: "Pin",
                render: (u) =>
                  u.latitude != null && u.longitude != null ? (
                    <span className="font-mono text-xs">
                      {Number(u.latitude).toFixed(4)}, {Number(u.longitude).toFixed(4)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">no pin</span>
                  ),
              },
              {
                key: "risk_level",
                header: "Risk",
                render: (u) =>
                  u.risk_level ? (
                    <Badge variant={u.risk_level === "high" ? "destructive" : "outline"}>{u.risk_level}</Badge>
                  ) : (
                    "—"
                  ),
              },
            ]}
          />
          {totalPages > 1 && (
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
