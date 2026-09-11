"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CircleDollarSign, Copy, ExternalLink, HeartHandshake, Users } from "lucide-react";
import { PageHeader, StatCard } from "@/components/shared/page-shell";
import { CampaignWebsite } from "@/components/shared/campaign-website";
import { DataTable } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { recordHqDonation, updateFundraisingGoal } from "@/lib/donations/actions";
import { paymentMethodLabel } from "@/lib/donations/summary";
import type { DonationsOverview } from "@/lib/donations/hq";
import { formatCurrency, formatDate } from "@/lib/utils";
import { toErrorMessage } from "@/lib/public-error";

function copyText(value: string, ok: string, empty: string) {
  if (!value) {
    toast.error(empty);
    return;
  }
  void navigator.clipboard.writeText(value);
  toast.success(ok);
}

export function DonationsView({
  overview,
  canWrite,
}: {
  overview: DonationsOverview;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleGoal(formData: FormData) {
    startTransition(async () => {
      const result = await updateFundraisingGoal(formData);
      if (result.error) {
        toast.error(toErrorMessage(result.error, "Could not save the goal"));
        return;
      }
      toast.success("Fundraising goal saved");
      router.refresh();
    });
  }

  function handleRecord(formData: FormData) {
    startTransition(async () => {
      const result = await recordHqDonation(formData);
      if (result.error) {
        toast.error(toErrorMessage(result.error, "Could not record that gift"));
        return;
      }
      toast.success("Gift recorded");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Donations"
        description={
          canWrite
            ? "Admin-only fundraising: Paystack gifts, donor records, and totals"
            : "View-only fundraising totals and Paystack gifts"
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Raised"
          value={formatCurrency(overview.raised)}
          change={overview.goal > 0 ? `${overview.progress}% of ${formatCurrency(overview.goal)} goal` : "Set a goal to track progress"}
          icon={CircleDollarSign}
        />
        <StatCard title="Gifts" value={overview.giftCount} icon={HeartHandshake} />
        <StatCard title="Donors" value={overview.uniqueDonors} icon={Users} />
        <StatCard
          title="Average gift"
          value={overview.giftCount ? formatCurrency(overview.average) : "—"}
        />
      </div>

      {overview.goal > 0 ? (
        <Card>
          <CardContent className="space-y-2 pt-6">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{formatCurrency(overview.raised)} raised</span>
              <span>{overview.progress}% of {formatCurrency(overview.goal)}</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${overview.progress}%` }} />
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-emerald-500/30 bg-emerald-500/5">
        <CardHeader>
          <CardTitle className="text-base">Public donate page</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Share this on <CampaignWebsite />. People enter their details, then pay on Paystack.
            Completed gifts land here when the Paystack webhook is connected.
          </p>
          <div className="space-y-1">
            <Label>Campaign donate page</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input readOnly value={overview.donateUrl || "Set NEXT_PUBLIC_APP_URL first"} className="font-mono text-xs" />
              <Button
                type="button"
                variant="secondary"
                onClick={() => copyText(overview.donateUrl, "Donate page copied", "Set NEXT_PUBLIC_APP_URL to get a donate page")}
                disabled={!overview.donateUrl}
              >
                <Copy className="mr-2 h-4 w-4" />
                Copy
              </Button>
              {overview.donateUrl ? (
                <Button type="button" variant="outline" asChild>
                  <a href={overview.donateUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open
                  </a>
                </Button>
              ) : null}
            </div>
          </div>
          <div className="space-y-1">
            <Label>Paystack checkout</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input readOnly value={overview.checkoutUrl} className="font-mono text-xs" />
              <Button
                type="button"
                variant="outline"
                onClick={() => copyText(overview.checkoutUrl, "Paystack link copied", "Paystack checkout is not set")}
                disabled={!overview.checkoutUrl}
              >
                Copy
              </Button>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Paystack webhook (HQ)</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input readOnly value={overview.webhookUrl} className="font-mono text-xs" />
              <Button
                type="button"
                variant="outline"
                onClick={() => copyText(overview.webhookUrl, "Webhook URL copied", "Webhook URL is not available")}
              >
                Copy
              </Button>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Same webhook (Paystack path)</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input readOnly value={overview.webhookAliasUrl} className="font-mono text-xs" />
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  copyText(overview.webhookAliasUrl, "Paystack webhook path copied", "Webhook URL is not available")
                }
              >
                Copy
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge variant={overview.paystackConfigured ? "success" : "warning"}>
              {overview.paystackConfigured ? "Paystack secret configured" : "Paystack secret missing on this server"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            In Paystack Dashboard → Settings → API Keys & Webhooks, set the Live Webhook URL to one of the
            copied CCC URLs (not the old Render fundraising app). Then set PAYSTACK_SECRET_KEY on Vercel
            Production so charges can be verified.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {canWrite ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Fundraising goal</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={handleGoal} key={`goal-${overview.goal}`} className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1 space-y-1">
                  <Label htmlFor="fundraising_goal">Goal (₦)</Label>
                  <Input
                    id="fundraising_goal"
                    name="fundraising_goal"
                    type="number"
                    min="0"
                    step="1000"
                    defaultValue={overview.goal || ""}
                    placeholder="e.g. 5000000"
                  />
                </div>
                <Button type="submit" variant="secondary" disabled={pending}>
                  Save goal
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Fundraising goal</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {overview.goal > 0 ? formatCurrency(overview.goal) : "No goal set yet."}
              </p>
            </CardContent>
          </Card>
        )}

        {canWrite ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Record an offline gift</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={handleRecord} key={`gifts-${overview.giftCount}`} className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1 sm:col-span-2">
                    <Label htmlFor="full_name">Donor name</Label>
                    <Input id="full_name" name="full_name" required />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" name="email" type="email" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="phone">Phone</Label>
                    <Input id="phone" name="phone" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="amount">Amount (₦)</Label>
                    <Input id="amount" name="amount" type="number" min="1" required />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="payment_method">Method</Label>
                    <NativeSelect id="payment_method" name="payment_method" defaultValue="bank_transfer">
                      <option value="bank_transfer">Bank transfer</option>
                      <option value="cash">Cash</option>
                      <option value="paystack">Paystack (manual)</option>
                    </NativeSelect>
                  </div>
                </div>
                <Button type="submit" size="sm" disabled={pending}>
                  Record gift
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : null}
      </div>

      {overview.pendingDonors.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Started checkout, no gift yet</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              These people opened the donate page and were saved as donors, but no completed payment is on the ledger.
            </p>
            {overview.pendingDonors.map((donor) => (
              <p key={donor.id} className="text-sm">
                <Link href={`/crm/${donor.id}`} className="font-medium hover:underline">
                  {donor.full_name}
                </Link>
                <span className="text-muted-foreground">
                  {donor.email ? ` · ${donor.email}` : ""}
                  {donor.phone ? ` · ${donor.phone}` : ""}
                  {donor.created_at ? ` · ${formatDate(donor.created_at)}` : ""}
                </span>
              </p>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <DataTable
        data={overview.gifts}
        searchKeys={["donor_name", "donor_email", "donor_phone", "payment_reference"]}
        searchPlaceholder="Search donors or payment reference"
        emptyMessage="No gifts recorded yet. Share the donate page, or record an offline gift."
        columns={[
          {
            key: "donor_name",
            header: "Donor",
            render: (gift) =>
              gift.contact_id ? (
                <Link href={`/crm/${gift.contact_id}`} className="hover:underline">
                  {gift.donor_name}
                </Link>
              ) : (
                gift.donor_name
              ),
          },
          {
            key: "amount",
            header: "Amount",
            render: (gift) => formatCurrency(gift.amount, gift.currency || "NGN"),
          },
          {
            key: "payment_method",
            header: "Method",
            render: (gift) => paymentMethodLabel(gift.payment_method),
          },
          {
            key: "payment_reference",
            header: "Reference",
            render: (gift) => gift.payment_reference || "—",
          },
          {
            key: "created_at",
            header: "Date",
            render: (gift) => formatDate(gift.created_at),
          },
        ]}
      />
    </div>
  );
}
