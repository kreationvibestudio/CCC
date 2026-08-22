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
  listAgentAssignments,
  nudgeAssignedAgent,
  unassignPollingAgent,
  type AssignmentRow,
} from "@/lib/agents/actions";
import { AGENT_CSV_TEMPLATE, parseAgentAssignmentCsv } from "@/lib/agents/csv";
import { queryPollingUnits, type PollingUnitListItem } from "@/lib/polling-units/actions";

type Credential = { email: string; puCode: string; password: string };

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
  const [credentials, setCredentials] = useState<Credential[]>([]);
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
    });
  }, [debounced, page]);

  function downloadTemplate() {
    const blob = new Blob([AGENT_CSV_TEMPLATE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "polling-agents-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadCredentials() {
    if (!credentials.length) return;
    const csv = ["email,temporary_password,pu_code", ...credentials.map((c) => `${c.email},${c.password},${c.puCode}`)].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "polling-agent-passwords.csv";
    a.click();
    URL.revokeObjectURL(url);
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
      if (result.created && result.temporaryPassword && result.email) {
        setCredentials((prev) => [
          { email: result.email!, password: result.temporaryPassword!, puCode: result.puCode ?? "" },
          ...prev,
        ]);
        toast.success(`Created login for ${result.email}. Copy the temporary password now.`);
      } else {
        toast.success(`Tied ${result.email} to ${result.puCode}`);
      }
      router.refresh();
      const listed = await listAgentAssignments({ search: debounced, page, pageSize: 40 });
      setRows(listed.rows);
      setTotal(listed.total);
    });
  }

  async function handleCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const parsed = parseAgentAssignmentCsv(await file.text());
    if (!parsed.length) {
      toast.error("CSV needs columns pu_code, email, full_name, phone");
      e.target.value = "";
      return;
    }
    const created: Credential[] = [];
    let ok = 0;
    let failed = 0;
    for (let i = 0; i < parsed.length; i += 1) {
      setImporting(`${i + 1}/${parsed.length}`);
      const row = parsed[i];
      const result = await assignPollingAgent(row);
      if (result.error) failed += 1;
      else {
        ok += 1;
        if (result.created && result.temporaryPassword && result.email) {
          created.push({
            email: result.email,
            password: result.temporaryPassword,
            puCode: result.puCode ?? row.puCode,
          });
        }
      }
    }
    setImporting("");
    e.target.value = "";
    if (created.length) setCredentials((prev) => [...created, ...prev]);
    toast.success(`Tied ${ok} agent${ok === 1 ? "" : "s"} to polling units${failed ? ` (${failed} failed)` : ""}`);
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
      router.refresh();
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
        description="Tie each of your 332 polling agents to their unit. The Agent Portal then opens on that PU."
      >
        <Button variant="outline" asChild>
          <Link href="/polling-units">Back to polling units</Link>
        </Button>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard title="PUs with an agent" value={assignedPus.toLocaleString()} change="One named agent per unit" />
        <StatCard title="Polling agent logins" value={agents.toLocaleString()} change="Can open Agent Portal" />
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
              <Label htmlFor="email">Email (login)</Label>
              <Input id="email" name="email" type="email" required disabled={pending} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" disabled={pending} />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Create / tie to this PU"}
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
            Upload a sheet with <code>pu_code,email,full_name,phone</code>. Existing emails are reused and
            set as polling agents; new emails get a login. Each agent is tied to exactly one unit.
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
          </div>
        </CardContent>
      </Card>

      {credentials.length > 0 && (
        <Card className="border-amber-500/40">
          <CardHeader>
            <CardTitle>Temporary passwords</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Shown once. Share securely; agents should change the password after first login at /login.
            </p>
            <Button type="button" variant="secondary" onClick={downloadCredentials}>
              Download password CSV
            </Button>
            <div className="max-h-56 overflow-auto text-sm">
              {credentials.slice(0, 20).map((c) => (
                <p key={c.email} className="font-mono">
                  {c.email} · {c.puCode} · {c.password}
                </p>
              ))}
              {credentials.length > 20 && <p className="text-muted-foreground">+ {credentials.length - 20} more in the download</p>}
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
                  {row.ward}, {row.lga} · {row.agent_name} · {row.agent_email}
                  {row.agent_phone ? ` · ${row.agent_phone}` : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={pending || !row.assigned_agent_id}
                  onClick={() => handleNudge(row.assigned_agent_id)}
                >
                  Nudge app
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
