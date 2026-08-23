"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader, StatCard } from "@/components/shared/page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  assignPollingAgent,
  getAgentAccessCodesSql,
  listAgentAssignments,
  nudgeAssignedAgent,
  resetAgentAccessCode,
  unassignPollingAgent,
  type AssignmentRow,
} from "@/lib/agents/actions";
import { AGENT_CSV_TEMPLATE, parseAgentAssignmentCsv } from "@/lib/agents/csv";
import { queryPollingUnits, type PollingUnitListItem } from "@/lib/polling-units/actions";

type IssuedCode = { code: string; puCode: string; name: string };

function copyText(value: string) {
  return navigator.clipboard.writeText(value);
}

export function AgentRosterView({
  assignedPus,
  agents,
}: {
  assignedPus: number;
  agents: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<AssignmentRow[]>([]);
  const [total, setTotal] = useState(0);
  const [codesTableMissing, setCodesTableMissing] = useState(false);
  const [issued, setIssued] = useState<IssuedCode[]>([]);
  const [gapLga, setGapLga] = useState("");
  const [gaps, setGaps] = useState<PollingUnitListItem[]>([]);
  const [importing, setImporting] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(0);
  }, [debounced]);

  useEffect(() => {
    startTransition(async () => {
      const result = await listAgentAssignments({
        search: debounced,
        page,
        pageSize: 40,
      });
      setRows(result.rows);
      setTotal(result.total);
      setCodesTableMissing(Boolean(result.codesTableMissing));
    });
  }, [debounced, page]);

  function rememberCode(result: { agentCode?: string; puCode?: string; fullName?: string; email?: string }) {
    if (!result.agentCode) return;
    setIssued((prev) => [
      {
        code: result.agentCode!,
        puCode: result.puCode ?? "",
        name: result.fullName || result.email || "Field Agent",
      },
      ...prev,
    ]);
  }

  function downloadTemplate() {
    const blob = new Blob([AGENT_CSV_TEMPLATE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "polling-agents-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadCodes() {
    if (!issued.length) return;
    const csv = ["agent_code,pu_code,agent_name", ...issued.map((c) => `${c.code},${c.puCode},${c.name}`)].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "polling-agent-codes.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copySql() {
    const result = await getAgentAccessCodesSql();
    if ("error" in result && result.error) {
      toast.error(result.error);
      return;
    }
    await copyText(result.sql);
    toast.success("SQL copied. Paste it in the Supabase SQL editor.");
  }

  function handleAssign(formData: FormData) {
    startTransition(async () => {
      const result = await assignPollingAgent({
        puCode: String(formData.get("pu_code") ?? ""),
        email: String(formData.get("email") ?? ""),
        fullName: String(formData.get("full_name") ?? ""),
        phone: String(formData.get("phone") ?? ""),
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      rememberCode(result);
      if (result.agentCode) {
        await copyText(result.agentCode).catch(() => undefined);
        toast.success(`Agent code ${result.agentCode} for ${result.puCode}. Copied.`);
      } else {
        toast.success(`Tied the agent to ${result.puCode}`);
      }
      if (result.missingCoordinates) {
        toast.warning("This polling unit has no map pin. Geocode it or the agent cannot sign in with GPS.");
      }
      router.refresh();
      const listed = await listAgentAssignments({ search: debounced, page, pageSize: 40 });
      setRows(listed.rows);
      setTotal(listed.total);
      setCodesTableMissing(Boolean(listed.codesTableMissing));
    });
  }

  async function handleCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const parsed = parseAgentAssignmentCsv(await file.text());
    if (!parsed.length) {
      toast.error("CSV needs a pu_code column. Name is enough; email is optional.");
      e.target.value = "";
      return;
    }
    const created: IssuedCode[] = [];
    let ok = 0;
    let failed = 0;
    let missingPin = 0;
    for (let i = 0; i < parsed.length; i += 1) {
      setImporting(`${i + 1}/${parsed.length}`);
      const row = parsed[i];
      const result = await assignPollingAgent(row);
      if (result.error) failed += 1;
      else {
        ok += 1;
        if (result.missingCoordinates) missingPin += 1;
        if (result.agentCode) {
          created.push({
            code: result.agentCode,
            puCode: result.puCode ?? row.puCode,
            name: result.fullName || row.fullName || row.email || "Field Agent",
          });
        }
      }
    }
    setImporting("");
    e.target.value = "";
    if (created.length) setIssued((prev) => [...created, ...prev]);
    toast.success(`Tied ${ok} agent${ok === 1 ? "" : "s"} to polling units${failed ? ` (${failed} failed)` : ""}`);
    if (missingPin) {
      toast.warning(`${missingPin} unit${missingPin === 1 ? "" : "s"} have no map pin. Agents cannot GPS-check in until you geocode them.`);
    }
    router.refresh();
  }

  function handleUnassign(id: string) {
    startTransition(async () => {
      const result = await unassignPollingAgent(id);
      if (result.error) toast.error(result.error);
      else toast.success("Agent unassigned");
      const listed = await listAgentAssignments({ search: debounced, page, pageSize: 40 });
      setRows(listed.rows);
      setTotal(listed.total);
      setCodesTableMissing(Boolean(listed.codesTableMissing));
      router.refresh();
    });
  }

  function handleReset(id: string) {
    startTransition(async () => {
      const result = await resetAgentAccessCode(id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      rememberCode({ agentCode: result.agentCode, puCode: rows.find((r) => r.id === id)?.pu_code ?? "", fullName: rows.find((r) => r.id === id)?.agent_name ?? "" });
      if (result.agentCode) {
        await copyText(result.agentCode).catch(() => undefined);
        toast.success(`New code ${result.agentCode}. Previous code no longer works.`);
      }
    });
  }

  function handleNudge(userId: string | null) {
    if (!userId) {
      toast.error("No agent login on this unit");
      return;
    }
    startTransition(async () => {
      const result = await nudgeAssignedAgent(userId);
      if (result.error) toast.error(result.error);
      else toast.success(`Push sent (${"sent" in result ? result.sent : 0})`);
    });
  }

  function loadGaps() {
    const q = gapLga.trim();
    if (q.length < 2) {
      toast.error("Enter an LGA name or PU code");
      return;
    }
    startTransition(async () => {
      const byLga = await queryPollingUnits({ lga: q, unassignedOnly: true, pageSize: 50 });
      if (byLga.total > 0) {
        setGaps(byLga.rows);
        return;
      }
      const byCode = await queryPollingUnits({ search: q, unassignedOnly: true, pageSize: 50 });
      setGaps(byCode.rows);
    });
  }

  const pages = Math.max(1, Math.ceil(total / 40));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Polling agents"
        description="Issue an 8-character code per Field Agent, tied to one polling unit. They open CCC Agent with that code — no email or password. GPS must match the unit at sign-in."
      >
        <Button variant="outline" asChild>
          <Link href="/polling-units">Back to polling units</Link>
        </Button>
      </PageHeader>

      {codesTableMissing && (
        <Card className="border-amber-500/40">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <p className="text-sm">
              Agent codes are not in this database yet. Run the SQL in the Supabase editor, then create agents again.
            </p>
            <Button type="button" variant="secondary" onClick={() => void copySql()}>
              Copy SQL
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard title="PUs with an agent" value={assignedPus.toLocaleString()} change="One named agent per unit" />
        <StatCard title="Polling agent logins" value={agents.toLocaleString()} change="CCC Agent app codes" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Assign one agent</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={handleAssign} className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="pu_code">PU code</Label>
              <Input id="pu_code" name="pu_code" placeholder="12/03/005 or INEC PU code" required disabled={pending} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="full_name">Agent name</Label>
              <Input id="full_name" name="full_name" required disabled={pending} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" disabled={pending} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="email">Email (optional)</Label>
              <Input id="email" name="email" type="email" disabled={pending} placeholder="Only if you still want email login" />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Issue code / tie to this PU"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bulk assign (CSV)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Upload a sheet with <code>pu_code,full_name,phone,email</code>. Email is optional. Each row gets an
            agent code tied to that unit.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={downloadTemplate}>
              Download template
            </Button>
            <Button variant="secondary" asChild>
              <label className="cursor-pointer">
                {importing ? `Importing ${importing}…` : "Upload CSV"}
                <input type="file" accept=".csv" className="hidden" onChange={(e) => void handleCsv(e)} disabled={Boolean(importing)} />
              </label>
            </Button>
            <Button type="button" variant="ghost" onClick={() => void copySql()}>
              Copy agent-codes SQL
            </Button>
          </div>
        </CardContent>
      </Card>

      {issued.length > 0 && (
        <Card className="border-amber-500/40">
          <CardHeader>
            <CardTitle>Agent codes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Shown once. Share the code with the agent. They enter it in CCC Agent while standing at the unit.
            </p>
            <Button type="button" variant="secondary" onClick={downloadCodes}>
              Download codes CSV
            </Button>
            <div className="max-h-56 space-y-2 overflow-auto text-sm">
              {issued.slice(0, 20).map((c) => (
                <div key={`${c.code}-${c.puCode}`} className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-mono text-base tracking-wide">
                    {c.code} <span className="text-muted-foreground">· {c.puCode} · {c.name}</span>
                  </p>
                  <Button type="button" size="sm" variant="outline" onClick={() => void copyText(c.code).then(() => toast.success("Copied"))}>
                    Copy
                  </Button>
                </div>
              ))}
              {issued.length > 20 && <p className="text-muted-foreground">+ {issued.length - 20} more in the download</p>}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Units still without an agent</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Input
              value={gapLga}
              onChange={(e) => setGapLga(e.target.value)}
              placeholder="LGA name or PU code"
              className="max-w-xs"
            />
            <Button type="button" variant="outline" onClick={loadGaps} disabled={pending}>
              Find unassigned
            </Button>
          </div>
          {gaps.map((u) => (
            <p key={u.id} className="text-sm">
              <span className="font-medium">{u.pu_code || u.code}</span> — {u.name} · {u.ward}, {u.lga}
              {u.latitude == null || u.longitude == null ? " · no map pin" : ""}
            </p>
          ))}
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-semibold">Assigned units</h2>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by PU code…"
            className="max-w-xs"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {total.toLocaleString()} assignments · page {page + 1} of {pages}
        </p>
        {rows.map((row) => (
          <Card key={row.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="font-medium">
                  {row.pu_code || row.code} — {row.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {row.ward}, {row.lga} · {row.agent_name}
                  {row.agent_email && !row.agent_email.endsWith("@ccc.agent") ? ` · ${row.agent_email}` : ""}
                  {row.agent_phone ? ` · ${row.agent_phone}` : ""}
                  {row.agent_code_hint ? ` · code …${row.agent_code_hint}` : " · no code yet"}
                  {row.has_coordinates ? "" : " · no map pin"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={pending || !row.assigned_agent_id}
                  onClick={() => handleNudge(row.assigned_agent_id)}
                >
                  Nudge app
                </Button>
                <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => handleReset(row.id)}>
                  Reset code
                </Button>
                <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => handleUnassign(row.id)}>
                  Unassign
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {pages > 1 && (
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= pages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
