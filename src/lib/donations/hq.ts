import { createClient } from "@/lib/supabase/server";
import { authorize } from "@/lib/auth/session";
import { fetchAllRows } from "@/lib/supabase/paginate";
import { appBaseUrl, paystackPaymentLinkFromSetting } from "@/lib/campaign";
import { paystackSecretKey } from "@/lib/integrations/paystack/client";
import { fundraisingProgress, summarizeDonations } from "@/lib/donations/summary";
import { paystackWebhookUrls } from "@/lib/donations/webhooks";

export type DonationGift = {
  id: string;
  amount: number;
  currency: string;
  payment_method: string | null;
  payment_reference: string | null;
  created_at: string;
  contact_id: string | null;
  donor_name: string;
  donor_email: string | null;
  donor_phone: string | null;
};

export type PendingDonor = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  created_at: string;
};

export type DonationsOverview = {
  raised: number;
  giftCount: number;
  uniqueDonors: number;
  average: number;
  goal: number;
  progress: number;
  gifts: DonationGift[];
  pendingDonors: PendingDonor[];
  donateUrl: string;
  checkoutUrl: string;
  webhookUrl: string;
  webhookAliasUrl: string;
  paystackConfigured: boolean;
};

type ContactEmbed = {
  id?: string | null;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
};

type RawGift = {
  id: string;
  amount: number | string | null;
  currency?: string | null;
  payment_method?: string | null;
  payment_reference?: string | null;
  created_at: string;
  contact_id?: string | null;
  contacts?: ContactEmbed | ContactEmbed[] | null;
};

function settingText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (value && typeof value === "object") {
    const row = value as Record<string, unknown>;
    if (typeof row.url === "string") return row.url.trim();
    if (typeof row.value === "string") return row.value.trim();
  }
  return "";
}

function nestedContact(value: RawGift["contacts"]): ContactEmbed | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function flattenGift(row: RawGift): DonationGift {
  const contact = nestedContact(row.contacts);
  return {
    id: row.id,
    amount: Number(row.amount ?? 0),
    currency: row.currency?.trim() || "NGN",
    payment_method: row.payment_method ?? null,
    payment_reference: row.payment_reference ?? null,
    created_at: row.created_at,
    contact_id: row.contact_id ?? contact?.id ?? null,
    donor_name: (contact?.full_name ?? "").trim() || "Unknown donor",
    donor_email: contact?.email ?? null,
    donor_phone: contact?.phone ?? null,
  };
}

export async function getDonationsOverview(): Promise<DonationsOverview | { error: string }> {
  const gate = await authorize("donations.view");
  if (!gate.ok) return { error: gate.error };
  const tenantId = gate.user.profile.tenant_id;
  const supabase = await createClient();

  const [giftRows, pendingRows, tenantRes, linkSetting] = await Promise.all([
    fetchAllRows<RawGift>(
      (from, to) =>
        supabase
          .from("donations")
          .select("id, amount, currency, payment_method, payment_reference, created_at, contact_id, contacts(id, full_name, email, phone)")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false })
          .range(from, to),
      { max: 10_000 }
    ),
    supabase
      .from("contacts")
      .select("id, full_name, email, phone, created_at, total_donations")
      .eq("tenant_id", tenantId)
      .eq("contact_type", "donor")
      .eq("total_donations", 0)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase.from("tenants").select("fundraising_goal").eq("id", tenantId).maybeSingle(),
    supabase
      .from("tenant_settings")
      .select("value")
      .eq("tenant_id", tenantId)
      .eq("key", "paystack_payment_link")
      .maybeSingle(),
  ]);

  const gifts = giftRows.map(flattenGift);
  const totals = summarizeDonations(gifts);
  const goal = Number(tenantRes.data?.fundraising_goal ?? 0);
  const base = appBaseUrl();
  const slug = gate.user.workspace?.slug ?? "";
  const donateUrl = base && slug ? `${base}/donate/${slug}` : "";
  const webhooks = paystackWebhookUrls(base);

  return {
    ...totals,
    goal,
    progress: fundraisingProgress(totals.raised, goal),
    gifts,
    pendingDonors: (pendingRows.data ?? []).map((row) => ({
      id: row.id as string,
      full_name: String(row.full_name ?? "Donor"),
      email: (row.email as string | null) ?? null,
      phone: (row.phone as string | null) ?? null,
      created_at: String(row.created_at ?? ""),
    })),
    donateUrl,
    checkoutUrl: paystackPaymentLinkFromSetting(settingText(linkSetting.data?.value)),
    webhookUrl: webhooks.webhookUrl,
    webhookAliasUrl: webhooks.webhookAliasUrl,
    paystackConfigured: Boolean(paystackSecretKey()),
  };
}
