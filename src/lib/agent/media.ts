import { createServiceClient } from "@/lib/supabase/admin";
import type { AuthUser } from "@/lib/auth/session";

const BUCKET = "election-media";
const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic"]);

export async function uploadAgentMedia(
  user: AuthUser,
  file: File,
  kind: "result_sheet" | "incident"
) {
  if (!ALLOWED.has(file.type) && !file.name.match(/\.(jpe?g|png|webp|heic)$/i)) {
    return { error: "Upload a JPEG, PNG, or WebP photo" };
  }
  if (file.size > MAX_BYTES) return { error: "Photo must be under 8 MB" };

  const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${user.profile.tenant_id}/${user.id}/${kind}-${crypto.randomUUID()}.${ext}`;
  const admin = createServiceClient();
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error } = await admin.storage.from(BUCKET).upload(path, buffer, {
    contentType: file.type || "image/jpeg",
    upsert: false,
  });
  if (error) return { error: error.message };

  const { data: signed } = await admin.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24 * 365);
  return {
    path,
    url: signed?.signedUrl ?? path,
    kind,
  };
}

export async function upsertPushToken(
  user: AuthUser,
  token: string,
  platform: string
) {
  const trimmed = token.trim();
  if (trimmed.length < 8) return { error: "Invalid push token" };
  const admin = createServiceClient();
  const { error } = await admin.from("agent_device_tokens").upsert(
    {
      user_id: user.id,
      tenant_id: user.profile.tenant_id,
      token: trimmed,
      platform: platform === "ios" ? "ios" : "android",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "token" }
  );
  if (error) return { error: error.message };
  return { success: true as const };
}

export async function sendExpoPush(
  tokens: string[],
  title: string,
  body: string
): Promise<{ sent: number; error?: string }> {
  const messages = tokens
    .filter((t) => t.startsWith("ExponentPushToken[") || t.startsWith("ExpoPushToken["))
    .map((to) => ({
      to,
      sound: "default",
      title,
      body,
      channelId: "agent-alerts",
    }));
  if (!messages.length) return { sent: 0 };
  const res = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(messages),
  });
  if (!res.ok) return { sent: 0, error: `Expo push failed (${res.status})` };
  return { sent: messages.length };
}

export async function nudgeAgent(user: AuthUser, targetUserId: string, message?: string) {
  if (targetUserId === user.id) {
    /* HQ can nudge self in testing */
  }
  const admin = createServiceClient();
  const { data: target } = await admin
    .from("profiles")
    .select("id, full_name, tenant_id")
    .eq("id", targetUserId)
    .maybeSingle();
  if (!target || target.tenant_id !== user.profile.tenant_id) {
    return { error: "Agent not found in this workspace" };
  }
  const { data: rows } = await admin
    .from("agent_device_tokens")
    .select("token")
    .eq("user_id", targetUserId)
    .eq("tenant_id", user.profile.tenant_id);
  const tokens = (rows ?? []).map((r) => r.token);
  const title = "Campaign HQ";
  const body = message?.trim() || `Please submit your polling unit update now.`;
  const result = await sendExpoPush(tokens, title, body);
  if (!tokens.length) return { error: "That agent has no app registered for push yet", sent: 0 };
  return result;
}
