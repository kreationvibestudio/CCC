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
import { inviteUser, updateUserRole, zeroCampaignData } from "@/lib/admin/actions";
import { ROLE_LABELS, type UserRole } from "@/types/auth";

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
  { key: "googleMapsKey", label: "Google Maps key" },
];

export function AdminView({
  profiles,
  auditCount,
  secrets,
  donateUrl,
  paystackCheckoutUrl,
}: {
  profiles: ProfileRow[];
  auditCount: number;
  secrets: SecretsStatus;
  donateUrl: string;
  paystackCheckoutUrl: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [invitePassword, setInvitePassword] = useState<string | null>(null);

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

  const webhookUrl = donateUrl ? `${donateUrl.replace(/\/donate$/, "")}/api/donations/webhook` : "";

  function handleInvite(formData: FormData) {
    startTransition(async () => {
      const result = await inviteUser(formData);
      if (result.error) {
        toast.error(result.error);
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
        toast.error(result.error);
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
        toast.error(result.error);
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Team members</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {profiles.map((p) => (
            <div
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
            >
              <div>
                <p className="font-medium">{p.full_name}</p>
                <p className="text-xs text-muted-foreground">
                  {p.email}
                  {p.ward ? ` · ${p.ward}` : ""}
                </p>
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
          ))}
        </CardContent>
      </Card>

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
