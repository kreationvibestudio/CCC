"use client";

import { useEffect, useRef, useState, useTransition } from "react";
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
  getAgentIdentityMigrationSql,
  listAgentAssignments,
  listAgentCodesByName,
  listRecentAgentCheckins,
  nudgeAssignedAgent,
  resetAgentAccessCode,
  unassignPollingAgent,
  type AgentCheckinRow,
  type AssignmentRow,
} from "@/lib/agents/actions";
import { AGENT_LOGIN_RADIUS_FT, formatLoginDistance } from "@/lib/agent/geo";
import {
  FillMissingCodesButton,
  IssueCodesCallout,
  IssuePinnedCodesButton,
} from "@/components/polling-units/issue-pinned-codes-button";
import { PassportPhotoField } from "@/components/polling-units/passport-photo-field";
import { AGENT_CSV_TEMPLATE, parseAgentAssignmentCsv } from "@/lib/agents/csv";
import { collationLabel } from "@/lib/agents/identity-fields";
import { queryPollingUnits, type PollingUnitListItem } from "@/lib/polling-units/actions";
import { usePermissions } from "@/components/providers/auth-provider";
import { formatDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

type IssuedCode = { code: string; puCode: string; name: string };

type NamedCode = {
  name: string;
  code: string;
  puCode: string;
  unitName: string;
  lastSignedInAt: string | null;
  lastLoginDistanceM: number | null;
  lastLoginGpsVerified: boolean | null;
};

function copyText(value: string) {
  return navigator.clipboard.writeText(value);
}

function isShareableAgentCode(code: string) {
  const compact = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return compact.length === 8 || compact.length === 10;
}

function checkinSummary(input: {
  lastSignedInAt: string | null;
  lastLoginDistanceM: number | null;
  lastLoginGpsVerified: boolean | null;
}) {
  if (!input.lastSignedInAt) return "Has not signed in at the unit yet";
  const when = formatDateTime(input.lastSignedInAt);
  if (input.lastLoginGpsVerified) {
    const distance =
      input.lastLoginDistanceM != null ? ` · ${formatLoginDistance(input.lastLoginDistanceM)} from pin` : "";
    return `Checked in at unit ${when}${distance}`;
  }
  if (input.lastLoginDistanceM != null) {
    return `Signed in ${when} · ${formatLoginDistance(input.lastLoginDistanceM)} from pin`;
  }
  return `Signed in ${when}`;
}

export function AgentRosterView({
  assignedPus,
  agents,
}: {
  assignedPus: number;
  agents: number;
}) {
  const router = useRouter();
  const { canCreate, canDelete } = usePermissions();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<AssignmentRow[]>([]);
  const [total, setTotal] = useState(0);
  const [codesTableMissing, setCodesTableMissing] = useState(false);
  const [issued, setIssued] = useState<IssuedCode[]>([]);
  const [codesByName, setCodesByName] = useState<NamedCode[]>([]);
  const [checkins, setCheckins] = useState<AgentCheckinRow[]>([]);
  const [gapLga, setGapLga] = useState("");
  const [gaps, setGaps] = useState<PollingUnitListItem[]>([]);
  const [importing, setImporting] = useState("");
  const [needsIdentityMigration, setNeedsIdentityMigration] = useState(false);
  const [collationRole, setCollationRole] = useState<"none" | "ward" | "lga">("none");
  const [photoFieldKey, setPhotoFieldKey] = useState(0);
  const formRef = useRef<HTMLFormElement | null>(null);

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
      try {
        const directory = await listAgentCodesByName();
        setCodesByName(directory.rows);
        if (directory.codesTableMissing) setCodesTableMissing(true);
        setCheckins(await listRecentAgentCheckins());
      } catch {
        setCodesByName([]);
      }
    });
  }, [debounced, page]);

  async function reloadRoster() {
    const listed = await listAgentAssignments({ search: debounced, page, pageSize: 40 });
    setRows(listed.rows);
    setTotal(listed.total);
    setCodesTableMissing(Boolean(listed.codesTableMissing));
    try {
      const directory = await listAgentCodesByName();
      setCodesByName(directory.rows);
      if (directory.codesTableMissing) setCodesTableMissing(true);
      setCheckins(await listRecentAgentCheckins());
    } catch {
      setCodesByName([]);
    }
    router.refresh();
  }

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
    const source = codesByName.length
      ? codesByName
      : issued.map((c) => ({ name: c.name, code: c.code, puCode: c.puCode, unitName: "" }));
    if (!source.length) return;
    const csv = [
      "agent_name,agent_code,pu_code,unit_name",
      ...source.map((c) => `${c.name},${c.code},${c.puCode},${"unitName" in c ? c.unitName : ""}`),
    ].join("\n");
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

  async function copyIdentitySql() {
    const result = await getAgentIdentityMigrationSql();
    if ("error" in result && result.error) {
      toast.error(result.error);
      return;
    }
    await copyText(result.sql);
    toast.success("Identity-fields SQL copied. Paste it in the Supabase SQL editor, then Run.");
  }

  function handleAssign(formData: FormData) {
    startTransition(async () => {
      const result = await assignPollingAgent({
        puCode: String(formData.get("pu_code") ?? ""),
        email: String(formData.get("email") ?? ""),
        fullName: String(formData.get("full_name") ?? ""),
        phone: String(formData.get("phone") ?? ""),
        ward: String(formData.get("ward") ?? ""),
        membershipCardNumber: String(formData.get("membership_card_number") ?? ""),
        votersCardNumber: String(formData.get("voters_card_number") ?? ""),
        passportPhotoUrl: String(formData.get("passport_photo_url") ?? ""),
        collationRole: String(formData.get("collation_role") ?? "none"),
      });
      if (result.needsIdentityMigration) setNeedsIdentityMigration(true);
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
      if (result.needsIdentityMigration) {
        toast.warning("Agent saved, but identity columns are missing. Copy the SQL below and run it in Supabase.");
      }
      setCollationRole("none");
      setPhotoFieldKey((k) => k + 1);
      formRef.current?.reset();
      await reloadRoster();
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
      if (result.needsIdentityMigration) setNeedsIdentityMigration(true);
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
    await reloadRoster();
  }

  function handleUnassign(id: string) {
    startTransition(async () => {
      const result = await unassignPollingAgent(id);
      if (result.error) toast.error(result.error);
      else toast.success("Agent unassigned");
      await reloadRoster();
    });
  }

  function handleReset(id: string) {
    startTransition(async () => {
      const result = await resetAgentAccessCode(id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      const row = rows.find((r) => r.id === id);
      rememberCode({
        agentCode: result.agentCode,
        puCode: row?.pu_code || row?.code || "",
        fullName: row?.agent_name ?? "",
      });
      if (result.agentCode) {
        await copyText(result.agentCode).catch(() => undefined);
        toast.success(`New code ${result.agentCode}. Previous code no longer works.`);
      }
      await reloadRoster();
    });
  }

  function rememberIssued(codes: { name: string; code: string; puCode: string }[]) {
    setIssued((prev) => [
      ...codes.map((c) => ({ code: c.code, puCode: c.puCode, name: c.name })),
      ...prev,
    ]);
    void reloadRoster();
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
        description={`Issue an 8-character code per Field Agent, tied to one polling unit. They open CCC Agent with that code — no email or password. GPS must be within ${AGENT_LOGIN_RADIUS_FT} ft of the unit pin. 10-character codes already issued still work. Units without a map pin cannot check in.`}
      >
        <IssuePinnedCodesButton onIssued={rememberIssued} />
        <FillMissingCodesButton onIssued={rememberIssued} />
        <Button variant="outline" asChild>
          <Link href="/polling-units">Back to polling units</Link>
        </Button>
      </PageHeader>

      <IssueCodesCallout onIssued={rememberIssued} />

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

      <Card className="border-amber-500/40">
        <CardHeader>
          <CardTitle>Codes by agent</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Every assigned Field Agent, listed by name. Share the hyphenated code; they enter it in CCC Agent
            at the unit. Sign-in only works within {AGENT_LOGIN_RADIUS_FT} ft of that unit&apos;s map pin.
          </p>
          <div className="flex flex-wrap gap-2">
            <IssuePinnedCodesButton variant="secondary" onIssued={rememberIssued} />
            <FillMissingCodesButton onIssued={rememberIssued} />
            {codesByName.length > 0 ? (
              <Button type="button" variant="outline" onClick={downloadCodes}>
                Download codes CSV
              </Button>
            ) : null}
          </div>
          {codesByName.length > 0 ? (
            <>
              <div className="max-h-80 space-y-2 overflow-auto text-sm">
                {codesByName.map((c) => (
                  <div key={`${c.name}-${c.puCode}`} className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{c.name}</p>
                      <p className="font-mono text-base tracking-wide">
                        {c.code}{" "}
                        <span className="text-muted-foreground">
                          · {c.puCode} · {c.unitName}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">{checkinSummary(c)}</p>
                    </div>
                    {isShareableAgentCode(c.code) ? (
                      <Button type="button" size="sm" variant="outline" onClick={() => void copyText(c.code).then(() => toast.success("Copied"))}>
                        Copy
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm">
              No Field Agent is tied to a polling unit yet. Click{" "}
              <span className="font-medium">Issue codes for pinned units</span> to create one login per
              mapped unit, or assign a named agent below.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Agent check-ins</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Each successful CCC Agent sign-in at the assigned polling unit. GPS must be within{" "}
            {AGENT_LOGIN_RADIUS_FT} ft of the pin.
          </p>
          {checkins.length > 0 ? (
            <div className="max-h-80 space-y-2 overflow-auto text-sm">
              {checkins.map((row) => (
                <div key={row.id} className="rounded-md border border-border/60 px-3 py-2">
                  <p className="font-medium">{row.agentName}</p>
                  <p className="text-muted-foreground">
                    {row.puCode}
                    {row.unitName ? ` · ${row.unitName}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(row.loggedInAt)}
                    {row.gpsVerified
                      ? ` · at the unit${row.distanceM != null ? ` · ${formatLoginDistance(row.distanceM)} from pin` : ""}`
                      : row.distanceM != null
                        ? ` · ${formatLoginDistance(row.distanceM)} from pin`
                        : " · location not recorded"}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No agent has signed in at a polling unit yet.</p>
          )}
        </CardContent>
      </Card>

      {canCreate ? (
      <>
      {needsIdentityMigration ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <p className="font-medium">One SQL apply unlocks the new agent identity fields</p>
          <p className="mt-1 text-muted-foreground">
            Membership card, voter card, passport photo, and collation-agent flags need new columns on{" "}
            <code>profiles</code>.
          </p>
          <div className="mt-3">
            <Button type="button" size="sm" onClick={() => void copyIdentitySql()}>
              Copy identity-fields SQL
            </Button>
          </div>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Capture agent</CardTitle>
        </CardHeader>
        <CardContent>
          <form ref={formRef} action={handleAssign} className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="full_name">Name</Label>
              <Input id="full_name" name="full_name" required disabled={pending} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="membership_card_number">Membership card number</Label>
              <Input id="membership_card_number" name="membership_card_number" disabled={pending} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ward">Ward</Label>
              <Input id="ward" name="ward" required disabled={pending} placeholder="Must match the polling unit ward" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pu_code">Polling unit</Label>
              <Input
                id="pu_code"
                name="pu_code"
                placeholder="EDO/ESAN-WEST/01/001 or 12/03/01/001"
                required
                disabled={pending}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="phone">Phone number</Label>
              <Input id="phone" name="phone" required disabled={pending} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="voters_card_number">Voter&apos;s card number</Label>
              <Input id="voters_card_number" name="voters_card_number" disabled={pending} />
            </div>
            <PassportPhotoField key={photoFieldKey} disabled={pending} />
            <fieldset className="space-y-2 sm:col-span-2">
              <legend className="text-sm font-medium">Collation agent role</legend>
              <p className="text-xs text-muted-foreground">
                Tick one if this person will also serve as a collation agent. Leave both unchecked for a
                regular polling-unit agent.
              </p>
              <input type="hidden" name="collation_role" value={collationRole} />
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-input"
                  checked={collationRole === "ward"}
                  disabled={pending}
                  onChange={(e) => setCollationRole(e.target.checked ? "ward" : "none")}
                />
                <span>Ward collation agent</span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-input"
                  checked={collationRole === "lga"}
                  disabled={pending}
                  onChange={(e) => setCollationRole(e.target.checked ? "lga" : "none")}
                />
                <span>LGA collation agent</span>
              </label>
            </fieldset>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="email">Email (optional)</Label>
              <Input
                id="email"
                name="email"
                type="email"
                disabled={pending}
                placeholder="Only if you still want email login"
              />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Save agent / issue code"}
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
            Upload a sheet with{" "}
            <code>full_name,membership_card_number,ward,pu_code,phone,voters_card_number,collation_role</code>
            . <code>collation_role</code> may be <code>ward</code>, <code>lga</code>, or blank. Passport
            photos are captured one-by-one in the form above.
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
      </>
      ) : null}

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
              <span className="font-medium">{u.code}</span> — {u.name} · {u.ward}, {u.lga}
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
            placeholder="Search by agent name or PU code…"
            className="max-w-xs"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {total.toLocaleString()} assignments · page {page + 1} of {pages}
        </p>
        {rows.map((row) => (
          <Card key={row.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                {row.agent_passport_photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={row.agent_passport_photo_url}
                    alt=""
                    className="h-14 w-11 shrink-0 rounded object-cover"
                  />
                ) : null}
                <div className="min-w-0">
                <p className="font-medium">{row.agent_name || "Unnamed agent"}</p>
                <p className="font-mono text-base tracking-wide">
                  {row.agent_code || (row.agent_code_hint ? `…${row.agent_code_hint}` : "No code yet")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {row.code} — {row.name} · {row.ward}, {row.lga}
                  {row.agent_email && !row.agent_email.endsWith("@ccc.agent") ? ` · ${row.agent_email}` : ""}
                  {row.agent_phone ? ` · ${row.agent_phone}` : ""}
                  {row.has_coordinates ? "" : " · no map pin"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {[
                    row.agent_membership_card_number
                      ? `Membership ${row.agent_membership_card_number}`
                      : null,
                    row.agent_voters_card_number ? `PVC ${row.agent_voters_card_number}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "No membership / PVC on file"}
                </p>
                {collationLabel(row.agent_collation_role) ? (
                  <Badge variant="secondary" className="mt-1">
                    {collationLabel(row.agent_collation_role)}
                  </Badge>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  {checkinSummary({
                    lastSignedInAt: row.last_signed_in_at,
                    lastLoginDistanceM: row.last_login_distance_m,
                    lastLoginGpsVerified: row.last_login_gps_verified,
                  })}
                </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {row.agent_code && isShareableAgentCode(row.agent_code) ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void copyText(row.agent_code!).then(() => toast.success("Copied"))}
                  >
                    Copy code
                  </Button>
                ) : null}
                {canCreate ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={pending || !row.assigned_agent_id}
                  onClick={() => handleNudge(row.assigned_agent_id)}
                >
                  Nudge app
                </Button>
                ) : null}
                {canCreate ? (
                <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => handleReset(row.id)}>
                  Reset code
                </Button>
                ) : null}
                {canDelete ? (
                <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => handleUnassign(row.id)}>
                  Unassign
                </Button>
                ) : null}
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
