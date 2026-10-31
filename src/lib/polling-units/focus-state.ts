import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { CAMPAIGN_STATE, FOCUS_STATE_SETTING_KEY } from "@/lib/polling-units/scope";

function settingText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (value && typeof value === "object") {
    const row = value as Record<string, unknown>;
    if (typeof row.value === "string") return row.value.trim();
    if (typeof row.state === "string") return row.state.trim();
  }
  return "";
}

/** Optional UX default — never hides other states. */
export async function getCampaignFocusState(tenantId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tenant_settings")
    .select("value")
    .eq("tenant_id", tenantId)
    .eq("key", FOCUS_STATE_SETTING_KEY)
    .maybeSingle();
  const fromSetting = settingText(data?.value);
  if (fromSetting) return fromSetting;
  return null;
}

export async function setCampaignFocusState(tenantId: string, state: string | null) {
  const admin = createServiceClient();
  const trimmed = (state ?? "").trim();
  if (!trimmed) {
    await admin
      .from("tenant_settings")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("key", FOCUS_STATE_SETTING_KEY);
    return { success: true as const };
  }
  const { error } = await admin.from("tenant_settings").upsert(
    {
      tenant_id: tenantId,
      key: FOCUS_STATE_SETTING_KEY,
      value: trimmed,
    },
    { onConflict: "tenant_id,key" }
  );
  if (error) return { error: error.message };
  return { success: true as const };
}

export function defaultFocusFallback() {
  return CAMPAIGN_STATE === "EDO" ? "Edo" : CAMPAIGN_STATE;
}
