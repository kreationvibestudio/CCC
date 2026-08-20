"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  addPlatformOperator,
  cloneWorkspacePollingUnits,
  createWorkspace,
  inviteWorkspaceAdmin,
  resetWorkspace,
  startSupportAccess,
  type PlatformWorkspace,
} from "@/lib/platform/actions";

export function PlatformConsole({
  workspaces,
  parties,
  defaultCloneSource,
}: {
  workspaces: PlatformWorkspace[];
  parties: Array<{ code: string; name: string }>;
  defaultCloneSource: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [joinUrl, setJoinUrl] = useState<string | null>(null);

  function run<T extends { error?: string; success?: boolean; message?: string; temporaryPassword?: string; joinUrl?: string }>(
    action: () => Promise<T>,
    onOk?: () => void
  ) {
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      if (result.temporaryPassword) setTempPassword(result.temporaryPassword);
      if (result.joinUrl) setJoinUrl(result.joinUrl);
      if (result.message) toast.success(result.message);
      onOk?.();
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform console"
        description="Create isolated party workspaces. Each campaign only sees its own HQ, agents, and field data."
      />

      {(tempPassword || joinUrl) && (
        <Card className="border-emerald-500/40">
          <CardContent className="space-y-2 pt-6 text-sm">
            {tempPassword && (
              <p>
                Temporary password: <code className="rounded bg-muted px-1">{tempPassword}</code>
              </p>
            )}
            {joinUrl && (
              <p>
                Join link: <code className="break-all rounded bg-muted px-1">{joinUrl}</code>
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>New party workspace</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-3 sm:grid-cols-2"
            action={(formData) => run(() => createWorkspace(formData))}
          >
            <div className="space-y-1">
              <Label htmlFor="name">Campaign name</Label>
              <Input id="name" name="name" required placeholder="PDP Edo 2027" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="slug">URL slug</Label>
              <Input id="slug" name="slug" placeholder="pdp-edo" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="campaign_party">Their party</Label>
              <NativeSelect id="campaign_party" name="campaign_party" required defaultValue="NDC">
                {parties.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.code} — {p.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1">
              <Label htmlFor="clone_source">Copy polling units from</Label>
              <NativeSelect id="clone_source" name="clone_source" defaultValue={defaultCloneSource}>
                {workspaces.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.puCount.toLocaleString()} PUs)
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1">
              <Label htmlFor="hq_email">First HQ admin email</Label>
              <Input id="hq_email" name="hq_email" type="email" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="hq_name">HQ admin name</Label>
              <Input id="hq_name" name="hq_name" />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={pending}>
                {pending ? "Working…" : "Create workspace"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Workspaces</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {workspaces.length === 0 && <p className="text-sm text-muted-foreground">No workspaces yet.</p>}
          {workspaces.map((w) => (
            <div key={w.id} className="rounded-lg border p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium">
                  {w.name}{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    {w.party || "party unset"} · /{w.slug}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {w.userCount} users · {w.puCount.toLocaleString()} polling units
                </p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <form action={(formData) => run(() => startSupportAccess(formData))}>
                  <input type="hidden" name="tenant_id" value={w.id} />
                  <input type="hidden" name="reason" value="Support" />
                  <Button type="submit" size="sm" variant="secondary" disabled={pending}>
                    Open for support
                  </Button>
                </form>
                <form action={(formData) => run(() => cloneWorkspacePollingUnits(formData))}>
                  <input type="hidden" name="tenant_id" value={w.id} />
                  <input type="hidden" name="source_id" value={defaultCloneSource} />
                  <Button type="submit" size="sm" variant="outline" disabled={pending}>
                    Retry PU copy
                  </Button>
                </form>
                <form
                  action={(formData) => {
                    if (!confirm(`Clear operational data for ${w.name}? Polling units and users stay.`)) return;
                    run(() => resetWorkspace(formData));
                  }}
                >
                  <input type="hidden" name="tenant_id" value={w.id} />
                  <Button type="submit" size="sm" variant="destructive" disabled={pending}>
                    Reset data
                  </Button>
                </form>
              </div>
              <form
                className="mt-3 grid gap-2 sm:grid-cols-3"
                action={(formData) => run(() => inviteWorkspaceAdmin(formData))}
              >
                <input type="hidden" name="tenant_id" value={w.id} />
                <Input name="email" type="email" required placeholder="hq@party.ng" />
                <Input name="full_name" placeholder="HQ name" />
                <Button type="submit" size="sm" disabled={pending}>
                  Invite HQ admin
                </Button>
              </form>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Add platform operator</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex gap-2" action={(formData) => run(() => addPlatformOperator(formData))}>
            <Input name="email" type="email" required placeholder="you@vendor.com" />
            <Button type="submit" disabled={pending}>
              Add
            </Button>
          </form>
          <p className="mt-2 text-xs text-muted-foreground">
            That person must already have an account. You can also set PLATFORM_OPERATOR_EMAILS in the environment.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
