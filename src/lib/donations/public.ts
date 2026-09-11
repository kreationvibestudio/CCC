"use server";

import { headers } from "next/headers";
import { createServiceClient } from "@/lib/supabase/admin";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { paystackPaymentLinkFromSetting } from "@/lib/campaign";
import { initializePaystackTransaction, paystackSecretKey } from "@/lib/integrations/paystack/client";
import { resolveAppHost, resolveRequestHost } from "@/lib/lms/learn-url";
import { upsertPublicCrmContact } from "@/lib/crm/public-upsert";

function settingString(value: unknown) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "url" in value) return String((value as { url: string }).url);
  return "";
}

export async function startPublicDonation(
  slug: string,
  input: { fullName: string; email: string; phone?: string; amount?: string }
): Promise<{ error?: string; checkoutUrl?: string }> {
  const campaignSlug = slug.trim().toLowerCase();
  const fullName = input.fullName.trim();
  const email = input.email.trim().toLowerCase();
  const phone = (input.phone ?? "").replace(/[^\d+]/g, "").trim();
  const amountNaira = Number(String(input.amount ?? "").replace(/,/g, ""));

  if (fullName.length < 2) return { error: "Enter your full name." };
  if (!email.includes("@")) return { error: "Enter a valid email address." };
  if (phone && phone.replace(/\D/g, "").length < 10) {
    return { error: "Enter a valid Nigerian phone number." };
  }

  const requestHeaders = await headers();
  const verdict = await checkRateLimit("donationInit", `donate:${campaignSlug}:${clientIp(requestHeaders)}`);
  if (!verdict.allowed) return { error: "Too many donation attempts. Try again shortly." };

  const admin = createServiceClient();
  const { data: tenant } = await admin
    .from("tenants")
    .select("id, slug")
    .eq("slug", campaignSlug)
    .maybeSingle();
  if (!tenant?.id) return { error: "This donation link is invalid." };

  try {
    await upsertPublicCrmContact(admin, {
      tenantId: tenant.id,
      fullName,
      email,
      phone: phone || null,
      kind: "donor",
    });
  } catch {
    // Still send them to Paystack if CRM is unavailable.
  }

  const { data: linkSetting } = await admin
    .from("tenant_settings")
    .select("value")
    .eq("tenant_id", tenant.id)
    .eq("key", "paystack_payment_link")
    .maybeSingle();
  const shopUrl = paystackPaymentLinkFromSetting(settingString(linkSetting?.value));

  if (paystackSecretKey() && Number.isFinite(amountNaira) && amountNaira >= 100) {
    const host = resolveAppHost(
      process.env.NEXT_PUBLIC_APP_URL ?? "",
      resolveRequestHost({
        forwardedProto: requestHeaders.get("x-forwarded-proto"),
        forwardedHost: requestHeaders.get("x-forwarded-host"),
        host: requestHeaders.get("host"),
      })
    );
    const started = await initializePaystackTransaction({
      email,
      amountNaira: Math.round(amountNaira),
      callbackUrl: `${host}/donate/success`,
      metadata: {
        full_name: fullName,
        phone: phone || undefined,
        tenant_id: tenant.id,
      },
    });
    if ("data" in started) return { checkoutUrl: started.data.authorization_url };
  }

  return { checkoutUrl: shopUrl };
}
