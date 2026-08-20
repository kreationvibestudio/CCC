/** Single-tenant campaign id used by public donate, Facebook sync, and seed. */
export const CAMPAIGN_TENANT_ID = "a0000000-0000-0000-0000-000000000001";

export function appBaseUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "").trim().replace(/\/$/, "");
}
