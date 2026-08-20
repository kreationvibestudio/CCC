import { createServiceClient } from "@/lib/supabase/admin";

export async function assertPollingUnitInTenant(
  tenantId: string,
  pollingUnitId: string | null | undefined
): Promise<string | null> {
  const id = pollingUnitId?.trim() || "";
  if (!id) return null;
  const admin = createServiceClient();
  const { data } = await admin
    .from("polling_units")
    .select("id")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!data) return "Polling unit is not in this campaign workspace";
  return null;
}

export async function assertContactInTenant(
  tenantId: string,
  contactId: string | null | undefined
): Promise<string | null> {
  const id = contactId?.trim() || "";
  if (!id) return "Contact is required";
  const admin = createServiceClient();
  const { data } = await admin
    .from("contacts")
    .select("id")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!data) return "Contact is not in this campaign workspace";
  return null;
}

export async function assertEventInTenant(
  tenantId: string,
  eventId: string | null | undefined
): Promise<string | null> {
  const id = eventId?.trim() || "";
  if (!id) return "Event is required";
  const admin = createServiceClient();
  const { data } = await admin
    .from("campaign_events")
    .select("id")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!data) return "Event is not in this campaign workspace";
  return null;
}

export function slugifyWorkspace(raw: string) {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function platformOperatorEmails() {
  return (process.env.PLATFORM_OPERATOR_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.includes("@"));
}
