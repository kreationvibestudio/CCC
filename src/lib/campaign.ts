/** Seed / fallback workspace id for the original hosted campaign. */
export const CAMPAIGN_TENANT_ID = "a0000000-0000-0000-0000-000000000001";

/** Hosted Paystack checkout for this campaign (Shop payment page). */
export const DEFAULT_PAYSTACK_PAYMENT_LINK = "https://paystack.shop/pay/816txayv39";

export function appBaseUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "").trim().replace(/\/$/, "");
}

export function paystackPaymentLink() {
  return paystackPaymentLinkFromSetting(null);
}

export function paystackPaymentLinkFromSetting(stored: string | null | undefined) {
  const fromTenant = stored?.trim() ?? "";
  if (fromTenant && isPaystackCheckoutUrl(fromTenant)) return fromTenant.replace(/\/$/, "");
  const fromEnv = process.env.NEXT_PUBLIC_PAYSTACK_PAYMENT_LINK?.trim() ?? "";
  if (fromEnv && isPaystackCheckoutUrl(fromEnv)) return fromEnv.replace(/\/$/, "");
  return DEFAULT_PAYSTACK_PAYMENT_LINK;
}

export function isPaystackCheckoutUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    return host === "paystack.shop" || host === "paystack.com" || host.endsWith(".paystack.com");
  } catch {
    return false;
  }
}
