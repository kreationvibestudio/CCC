"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  activateWorkspaceLicense,
  startLicenseRenewalCheckout,
} from "@/lib/licensing/actions";
import { licenseStatusLabel, type TenantLicenseInfo } from "@/lib/licensing/status";

function formatCountdown(ms: number | null): string {
  if (ms == null) return "—";
  if (ms <= 0) return "Expired";
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs
    .toString()
    .padStart(2, "0")}`;
}

export function LicenseStatusCard({
  license,
  canManage,
  amountNaira,
}: {
  license: TenantLicenseInfo | null;
  canManage: boolean;
  amountNaira: number;
}) {
  const [pending, startTransition] = useTransition();
  const [now, setNow] = useState(() => Date.now());
  const amount = amountNaira;

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const expiresAtMs = license?.expiresAt ? new Date(license.expiresAt).getTime() : null;
  const msLeft = expiresAtMs == null ? null : expiresAtMs - now;
  const status = license?.status ?? "missing";

  function renew() {
    startTransition(async () => {
      const result = await startLicenseRenewalCheckout();
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      window.location.href = result.authorizationUrl;
    });
  }

  function activate(formData: FormData) {
    startTransition(async () => {
      const result = await activateWorkspaceLicense(formData);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("License activated — a copy was emailed when email is configured");
      window.location.reload();
    });
  }

  return (
    <Card id="license" className={status === "expired" || status === "missing" ? "border-amber-500/50" : undefined}>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base">Workspace license</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Annual CCC access for this campaign only. Renew in-platform before expiry.
          </p>
        </div>
        <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-right">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Renews in</p>
          <p className="font-mono text-sm font-semibold tabular-nums">{formatCountdown(msLeft)}</p>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={status === "active" ? "default" : "outline"}>
            {licenseStatusLabel(status)}
          </Badge>
          {license?.expiresAt ? (
            <span className="text-muted-foreground">
              Expires{" "}
              {new Date(license.expiresAt).toLocaleString("en-NG", {
                timeZone: "Africa/Lagos",
                dateStyle: "medium",
                timeStyle: "short",
              })}{" "}
              (Africa/Lagos)
            </span>
          ) : (
            <span className="text-muted-foreground">No active license on this workspace</span>
          )}
        </div>
        {license?.licenseKey ? (
          <p>
            License key · <code className="rounded bg-muted px-1 text-xs">{license.licenseKey}</code>
          </p>
        ) : null}

        {canManage && (status === "missing" || status === "expired") ? (
          <form action={activate} className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <div className="space-y-1">
              <Label htmlFor="license_key">Activate with license key</Label>
              <Input
                id="license_key"
                name="license_key"
                placeholder="CCC-XXXX-XXXX-XXXX-XXXX"
                required
                disabled={pending}
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Activate"}
              </Button>
            </div>
          </form>
        ) : null}

        {canManage ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={renew} disabled={pending}>
              {pending ? "Starting…" : `Renew for 1 year · ₦${amount.toLocaleString()}`}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** Compact countdown for the dashboard corner. */
export function LicenseCountdownChip({ license }: { license: TenantLicenseInfo | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  if (!license?.expiresAt) {
    return (
      <a
        href="/admin#license"
        className="fixed bottom-4 right-4 z-40 rounded-md border border-amber-500/40 bg-background/95 px-3 py-2 text-xs shadow-sm backdrop-blur"
      >
        License missing · open Admin
      </a>
    );
  }
  const ms = new Date(license.expiresAt).getTime() - now;
  const urgent = ms < 14 * 86_400_000;
  return (
    <a
      href="/admin#license"
      className={`fixed bottom-4 right-4 z-40 rounded-md border bg-background/95 px-3 py-2 text-xs shadow-sm backdrop-blur ${
        urgent ? "border-amber-500/50" : "border-border"
      }`}
      title="Workspace license countdown"
    >
      License · {formatCountdown(ms)}
    </a>
  );
}
