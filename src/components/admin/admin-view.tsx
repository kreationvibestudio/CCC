"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { inviteUser, updateUserRole, zeroCampaignData, getInviteRepairSql, updateCampaignDates, getCampaignDatesMigrationSql, deleteTeamMembers } from "@/lib/admin/actions";
import { ROLE_LABELS, type UserRole } from "@/types/auth";
import { toErrorMessage } from "@/lib/public-error";

function toDateInputValue(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

function CampaignDatesCard({
  campaignStartDate,
  campaignEndDate,
  electionDate,
  needsCampaignStartMigration,
}: {
  campaignStartDate: string | null;
  campaignEndDate: string | null;
  electionDate: string | null;
  needsCampaignStartMigration?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const result = await updateCampaignDates(fd);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Campaign dates saved");
        router.refresh();
      }
    });
  }

  function copyMigrationSql() {
    start(async () => {
      try {
        const sql = await getCampaignDatesMigrationSql();
        await navigator.clipboard.writeText(sql);
        toast.success("Campaign dates SQL copied — paste it in the Supabase SQL editor and run it");
      } catch {
        toast.error("Could not copy the campaign dates SQL");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Campaign dates</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {needsCampaignStartMigration ? (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
            <p className="font-medium">Database migration needed</p>
            <p className="mt-1 text-muted-foreground">
              Production is missing the <code className="text-xs">campaign_start_date</code> column.
              Copy the SQL below, run it once in the Supabase SQL editor, then save dates again.
            </p>
            <Button type="button" size="sm" variant="secondary" className="mt-2" onClick={copyMigrationSql} disabled={pending}>
              Copy campaign dates SQL
            </Button>
          </div>
        ) : null}
        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="campaign_start_date">Campaign start</Label>
            <Input
              id="campaign_start_date"
              name="campaign_start_date"
              type="date"
              defaultValue={toDateInputValue(campaignStartDate)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="campaign_end_date">Campaign end</Label>
            <Input
              id="campaign_end_date"
              name="campaign_end_date"
              type="date"
              defaultValue={toDateInputValue(campaignEndDate)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="election_date">Election day</Label>
            <Input
              id="election_date"
              name="election_date"
              type="date"
              defaultValue={toDateInputValue(electionDate)}
            />
          </div>
          <div className="sm:col-span-3">
            <Button type="submit" disabled={pending} size="sm">
              {pending ? "Saving…" : "Save dates"}
            </Button>
            <p className="mt-2 text-xs text-muted-foreground">
              These dates power the countdown timers on the Executive Dashboard.
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

type ProfileRow = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  ward: string | null;
  created_at: string;
};

type SecretsStatus = Record<string, boolean>;

const ROLE_OPTIONS = Object.entries(ROLE_LABELS) as [UserRole, string][];

const SECRET_LABELS: { key: keyof SecretsStatus; label: string; critical?: boolean }[] = [
  { key: "supabaseUrl", label: "Supabase URL", critical: true },
  { key: "supabaseAnon", label: "Supabase anon key", critical: true },
  { key: "supabaseServiceRole", label: "Supabase service role", critical: true },
  { key: "appUrl", label: "App URL", critical: true },
  { key: "termiiApiKey", label: "Termii API key", critical: true },
  { key: "termiiSenderId", label: "Termii sender ID", critical: true },
  { key: "facebookPageId", label: "Facebook page ID", critical: true },
  { key: "facebookUserToken", label: "Facebook user token" },
  { key: "facebookPageToken", label: "Facebook page token", critical: true },
  { key: "facebookAppCredentials", label: "Facebook app ID + secret (auto-refresh)" },
  { key: "cronSecret", label: "Cron secret (Facebook sync)", critical: true },
  { key: "paystackSecret", label: "Paystack secret key (optional CRM auto-record)" },
  { key: "appUrlProduction", label: "App URL is production (not localhost)", critical: true },
  { key: "openaiApiKey", label: "OpenAI API key" },
  { key: "mapboxToken", label: "Mapbox token (maps)" },
  { key: "googleMapsKey", label: "Google Maps key" },
];

export function AdminView({
  profiles,
  auditCount,
  secrets,
  donateUrl,
  volunteerUrl,
  paystackCheckoutUrl,
  campaignStartDate,
  campaignEndDate,
  electionDate,
  needsCampaignStartMigration = false,
  currentUserId,
}: {
  profiles: ProfileRow[];
  auditCount: number;
  secrets: SecretsStatus;
  donateUrl: string;
  volunteerUrl: string;
  paystackCheckoutUrl: string;
  campaignStartDate: string | null;
  campaignEndDate: string | null;
  electionDate: string | null;
  needsCampaignStartMigration?: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [invitePassword, setInvitePassword] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const deletableProfiles = profiles.filter((p) => p.id !== currentUserId);
  const allSelected =
    deletableProfiles.length > 0 && deletableProfiles.every((p) => selectedIds.includes(p.id));

  function toggleAll(checked: boolean) {
    setSelectedIds(checked ? deletableProfiles.map((p) => p.id) : []);
  }

  function toggleOne(id: string, checked: boolean) {
    setSelectedIds((prev) => (checked ? [...new Set([...prev, id])] : prev.filter((x) => x !== id)));
  }

  function handleDeleteSelected() {
    if (!selectedIds.length) {
      toast.error("Select at least one team member");
      return;
    }
    const names = profiles
      .filter((p) => selectedIds.includes(p.id))
      .map((p) => p.full_name || p.email)
      .join(", ");
    if (!window.confirm(`Delete ${selectedIds.length === 1 ? names : `${selectedIds.length} team members`}?\n\nThis permanently removes their login and cannot be undone.`)) {
      return;
    }
    const fd = new FormData();
    for (const id of selectedIds) fd.append("user_ids", id);
    startTransition(async () => {
      const result = await deleteTeamMembers(fd);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? `Deleted ${result.deleted} team member(s)`);
      setSelectedIds([]);
      router.refresh();
    });
  }

  function copyDonateLink() {
    const url = paystackCheckoutUrl || donateUrl;
    if (!url) {
      toast.error("Donate link is not available");
      return;
    }
    void navigator.clipboard.writeText(url);
    toast.success("Donate link copied");
  }

  function copyCampaignDonatePage() {
    if (!donateUrl) {
      toast.error("Set NEXT_PUBLIC_APP_URL to get a campaign donate page");
      return;
    }
    void navigator.clipboard.writeText(donateUrl);
    toast.success("Campaign donate page copied");
  }

  function copyVolunteerSignupPage() {
    if (!volunteerUrl) {
      toast.error("Set NEXT_PUBLIC_APP_URL to get a volunteer signup page");
      return;
    }
    void navigator.clipboard.writeText(volunteerUrl);
    toast.success("Volunteer signup link copied");
  }

  function copyInviteRepairSql() {
    startTransition(async () => {
      try {
        const sql = await getInviteRepairSql();
        await navigator.clipboard.writeText(sql);
        toast.success("SQL copied. Paste it in the Supabase SQL editor and click Run.");
      } catch {
        toast.error("Could not copy the repair SQL");
      }
    });
  }

  const webhookUrl = donateUrl ? `${donateUrl.replace(/\/donate$/, "")}/api/donations/webhook` : "";

  function handleInvite(formData: FormData) {
    startTransition(async () => {
      const result = await inviteUser(formData);
      if (result.error) {
        toast.error(toErrorMessage(result.error, "Could not invite that user"));
        return;
      }
      if ("temporaryPassword" in result && result.temporaryPassword) {
        setInvitePassword(result.temporaryPassword);
        toast.success(result.message ?? "User invited");
      } else {
        toast.success("User invited");
      }
      router.refresh();
    });
  }

  function handleZeroCampaign() {
    if (
      !window.confirm(
        "This deletes volunteers, CRM, events, comments, social posts, SMS, and the sample briefing. Polling units and user accounts stay. Continue?"
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await zeroCampaignData();
      if (result.error) {
        toast.error(toErrorMessage(result.error, "Could not reset campaign data"));
        return;
      }
      toast.success(result.message ?? "Campaign data cleared");
      router.refresh();
    });
  }

  function handleRoleChange(formData: FormData) {
    startTransition(async () => {
      const result = await updateUserRole(formData);
      if (result.error) {
        toast.error(toErrorMessage(result.error, "Could not update that role"));
        return;
      }
      toast.success("Role updated");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Administration"
        description="Invite team members, assign roles, and check production secrets"
      />

      <Card>
        <CardHeader>
          <CardTitle>Public volunteer signup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Share this link on{" "}
            <a
              className="underline underline-offset-2"
              href="https://akhakonanenih.info"
              target="_blank"
              rel="noreferrer"
            >
              akhakonanenih.info
            </a>{" "}
            (for example a “Volunteer” button in Get in touch). New signups appear under Volunteers.
          </p>
          <div className="space-y-1">
            <Label>Signup page</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input readOnly value={volunteerUrl || "Set NEXT_PUBLIC_APP_URL first"} />
              <Button
                type="button"
                variant="secondary"
                onClick={copyVolunteerSignupPage}
                disabled={!volunteerUrl}
              >
                Copy link
              </Button>
              {volunteerUrl ? (
                <Button type="button" variant="outline" asChild>
                  <a href={volunteerUrl} target="_blank" rel="noreferrer">
                    Open
                  </a>
                </Button>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Public donate page</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Share the Paystack checkout link. Supporters enter amount and pay on Paystack. The
            campaign page at /donate sends people to the same checkout.
          </p>
          <div className="space-y-1">
            <Label>Paystack checkout</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input readOnly value={paystackCheckoutUrl} />
              <Button type="button" variant="secondary" onClick={copyDonateLink} disabled={!paystackCheckoutUrl}>
                Copy link
              </Button>
              <Button type="button" variant="outline" asChild>
                <a href={paystackCheckoutUrl} target="_blank" rel="noreferrer">
                  Open
                </a>
              </Button>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Campaign page</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input readOnly value={donateUrl || "Set NEXT_PUBLIC_APP_URL first"} />
              <Button type="button" variant="outline" onClick={copyCampaignDonatePage} disabled={!donateUrl}>
                Copy
              </Button>
            </div>
          </div>
          {secrets.paystackSecret && webhookUrl ? (
            <p className="text-xs text-muted-foreground">
              Optional CRM auto-record webhook: {webhookUrl}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Gifts are collected on Paystack. Add PAYSTACK_SECRET_KEY and the webhook later if
              you want gifts to appear automatically in Campaign CRM.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle>Reset campaign data</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Removes sample and operational rows (volunteers, CRM, events, comments, Facebook
            posts, donations, SMS, AI briefings, audit log). Keeps polling units and team
            accounts. Does not rewrite polling-unit rows, so it should finish in seconds.
          </p>
          <Button type="button" variant="destructive" disabled={pending} onClick={handleZeroCampaign}>
            {pending ? "Clearing…" : "Clear sample data (keep polling units)"}
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-muted-foreground">Team members</p>
            <p className="text-2xl font-bold">{profiles.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-muted-foreground">Audit log entries</p>
            <p className="text-2xl font-bold">{auditCount}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Invite team member</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={handleInvite} className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="full_name">Full name</Label>
              <Input id="full_name" name="full_name" required disabled={pending} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required disabled={pending} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="role">Role</Label>
              <NativeSelect
                id="role"
                name="role"
                defaultValue="supporter"
                disabled={pending}
              >
                {ROLE_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </NativeSelect>
              <p className="text-xs text-muted-foreground">
                Field Agents only use the CCC Agent app. Create them under Polling units → PU Agents to
                issue an agent code tied to a unit. GPS is checked at sign-in. Email is optional.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="ward">Ward</Label>
                <Input id="ward" name="ward" disabled={pending} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="lga">LGA</Label>
                <Input id="lga" name="lga" disabled={pending} />
              </div>
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={pending}>
                {pending ? "Working…" : "Invite user"}
              </Button>
            </div>
          </form>
          {invitePassword && (
            <p className="mt-3 rounded-md border border-border bg-muted/40 p-3 text-sm">
              Temporary password (copy now):{" "}
              <code className="font-mono text-foreground">{invitePassword}</code>
            </p>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            If invite shows “Database error creating new user”, the cloud signup trigger needs a one-time
            SQL fix.{" "}
            <button type="button" className="underline" onClick={copyInviteRepairSql} disabled={pending}>
              Copy SQL
            </button>
            {" · "}
            <a
              className="underline"
              href="https://supabase.com/dashboard/project/ffccfeodymiwwqshphmh/sql/new"
              target="_blank"
              rel="noreferrer"
            >
              Open SQL editor
            </a>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <CardTitle>Team members</CardTitle>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                className="h-4 w-4 accent-primary"
                checked={allSelected}
                disabled={pending || !deletableProfiles.length}
                onChange={(e) => toggleAll(e.target.checked)}
              />
              Select all
            </label>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={pending || selectedIds.length === 0}
              onClick={handleDeleteSelected}
            >
              {pending ? "Deleting…" : `Delete${selectedIds.length ? ` (${selectedIds.length})` : ""}`}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {profiles.length === 0 ? (
            <p className="text-sm text-muted-foreground">No team members yet.</p>
          ) : (
            profiles.map((p) => {
              const isSelf = p.id === currentUserId;
              return (
                <div
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 shrink-0 accent-primary"
                      checked={selectedIds.includes(p.id)}
                      disabled={pending || isSelf}
                      title={isSelf ? "You cannot delete your own account" : `Select ${p.full_name}`}
                      onChange={(e) => toggleOne(p.id, e.target.checked)}
                      aria-label={`Select ${p.full_name}`}
                    />
                    <div className="min-w-0">
                      <p className="font-medium">
                        {p.full_name}
                        {isSelf ? <span className="ml-2 text-xs font-normal text-muted-foreground">(you)</span> : null}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {p.email}
                        {p.ward ? ` · ${p.ward}` : ""}
                      </p>
                    </div>
                  </div>
                  <form action={handleRoleChange} className="flex items-center gap-2">
                    <input type="hidden" name="user_id" value={p.id} />
                    <NativeSelect
                      name="role"
                      defaultValue={p.role}
                      className="w-auto"
                      disabled={pending}
                    >
                      {ROLE_OPTIONS.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </NativeSelect>
                    <Button type="submit" size="sm" variant="secondary" disabled={pending}>
                      Save
                    </Button>
                    <Badge variant="secondary">{p.role.replace(/_/g, " ")}</Badge>
                  </form>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <CampaignDatesCard
        campaignStartDate={campaignStartDate}
        campaignEndDate={campaignEndDate}
        electionDate={electionDate}
        needsCampaignStartMigration={needsCampaignStartMigration}
      />

      <Card>
        <CardHeader>
          <CardTitle>Secrets readiness</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          {SECRET_LABELS.map(({ key, label, critical }) => {
            const ok = Boolean(secrets[key]);
            return (
              <div
                key={String(key)}
                className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
              >
                <span>
                  {label}
                  {critical ? " *" : ""}
                </span>
                <Badge variant={ok ? "default" : "outline"}>{ok ? "set" : "missing"}</Badge>
              </div>
            );
          })}
          <p className="sm:col-span-2 text-xs text-muted-foreground">
            Values are never shown here. Set missing keys in `.env.local`, then
            `npm run secrets:backup` + Vercel/GitHub. See docs/SECRETS.md and docs/TERMII-SETUP.md.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
