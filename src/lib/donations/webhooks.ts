export const CCC_PRODUCTION_ORIGIN = "https://ccc-three-kappa.vercel.app";

/** Paystack cannot POST to localhost, so HQ always copies a public webhook URL. */
export function paystackWebhookUrls(appUrl?: string | null) {
  const origin = (appUrl ?? "").trim().replace(/\/$/, "");
  const live = !origin || /localhost|127\.0\.0\.1/i.test(origin) ? CCC_PRODUCTION_ORIGIN : origin;
  return {
    webhookUrl: `${live}/api/donations/webhook`,
    webhookAliasUrl: `${live}/api/paystack/webhook`,
  };
}
