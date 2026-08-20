"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";
import { requirePermission, logAudit } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/admin";
import { ROLE_LABELS, type UserRole } from "@/types/auth";

const ROLES = Object.keys(ROLE_LABELS) as UserRole[];

function isUserRole(value: string): value is UserRole {
  return ROLES.includes(value as UserRole);
}

function tempPassword() {
  return `${randomBytes(9).toString("base64url")}Aa1!`;
}

export async function inviteUser(formData: FormData) {
  try {
    const adminUser = await requirePermission("admin.users");
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const fullName = String(formData.get("full_name") ?? "").trim() || email.split("@")[0];
    const roleRaw = String(formData.get("role") ?? "supporter");
    const ward = String(formData.get("ward") ?? "").trim() || null;
    const lga = String(formData.get("lga") ?? "").trim() || null;

    if (!email || !email.includes("@")) return { error: "Valid email is required" };
    if (!isUserRole(roleRaw)) return { error: "Invalid role" };
    if (roleRaw === "super_administrator" && adminUser.role !== "super_administrator") {
      return { error: "Only a super administrator can create another super administrator" };
    }

    const admin = createServiceClient();
    const password = tempPassword();
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        tenant_id: adminUser.profile.tenant_id,
        role: roleRaw,
      },
    });
    if (error) return { error: error.message };
    if (!data.user) return { error: "User creation failed" };

    const { error: profileError } = await admin.from("profiles").upsert(
      {
        id: data.user.id,
        tenant_id: adminUser.profile.tenant_id,
        email,
        full_name: fullName,
        role: roleRaw,
        ward,
        lga,
      },
      { onConflict: "id" }
    );
    if (profileError) return { error: profileError.message };

    await logAudit("admin.invite", "user", data.user.id, { email, role: roleRaw });
    revalidatePath("/admin");
    return {
      success: true as const,
      temporaryPassword: password,
      message: `Invited ${email}. Share the temporary password securely; they should change it after first login.`,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Invite failed" };
  }
}

export async function updateUserRole(formData: FormData) {
  try {
    const adminUser = await requirePermission("admin.users");
    const userId = String(formData.get("user_id") ?? "").trim();
    const roleRaw = String(formData.get("role") ?? "");

    if (!userId) return { error: "User is required" };
    if (!isUserRole(roleRaw)) return { error: "Invalid role" };
    if (userId === adminUser.id && roleRaw !== adminUser.role) {
      return { error: "You cannot change your own role" };
    }
    if (roleRaw === "super_administrator" && adminUser.role !== "super_administrator") {
      return { error: "Only a super administrator can assign that role" };
    }

    const admin = createServiceClient();
    const { data: existing, error: findError } = await admin
      .from("profiles")
      .select("id, email, role, tenant_id")
      .eq("id", userId)
      .eq("tenant_id", adminUser.profile.tenant_id)
      .maybeSingle();
    if (findError || !existing) return { error: "User not found in this campaign" };

    const { error } = await admin
      .from("profiles")
      .update({ role: roleRaw })
      .eq("id", userId)
      .eq("tenant_id", adminUser.profile.tenant_id);
    if (error) return { error: error.message };

    await logAudit("admin.role_change", "user", userId, {
      email: existing.email,
      from: existing.role,
      to: roleRaw,
    });
    revalidatePath("/admin");
    return { success: true as const };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Role update failed" };
  }
}

function isLiveSecret(value: string | undefined, minLength = 1) {
  const t = value?.trim() ?? "";
  if (t.length < minLength) return false;
  if (t === "[SENSITIVE]") return false;
  if (/^your[_-]/i.test(t)) return false;
  return true;
}

/** Booleans only — never expose secret values to the client. */
export async function getSecretsStatus() {
  await requirePermission("admin.users");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() ?? "";
  return {
    supabaseUrl: isLiveSecret(process.env.NEXT_PUBLIC_SUPABASE_URL) && /^https?:\/\//.test(process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""),
    supabaseAnon: isLiveSecret(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, 20),
    supabaseServiceRole: isLiveSecret(process.env.SUPABASE_SERVICE_ROLE_KEY, 20),
    appUrl: isLiveSecret(appUrl),
    appUrlProduction: isLiveSecret(appUrl) && !/localhost|127\.0\.0\.1/.test(appUrl),
    termiiApiKey: isLiveSecret(process.env.TERMII_API_KEY),
    termiiSenderId: isLiveSecret(process.env.TERMII_SENDER_ID),
    facebookPageId: isLiveSecret(process.env.FACEBOOK_PAGE_ID, 5),
    facebookUserToken: isLiveSecret(process.env.FACEBOOK_USER_ACCESS_TOKEN, 40),
    facebookPageToken: isLiveSecret(process.env.FACEBOOK_PAGE_ACCESS_TOKEN, 40),
    facebookAppCredentials: isLiveSecret(process.env.FACEBOOK_APP_ID) && isLiveSecret(process.env.FACEBOOK_APP_SECRET),
    openaiApiKey: isLiveSecret(process.env.OPENAI_API_KEY),
    googleMapsKey: isLiveSecret(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY),
    cronSecret: isLiveSecret(process.env.CRON_SECRET, 16),
    paystackSecret: isLiveSecret(process.env.PAYSTACK_SECRET_KEY, 20),
  };
}

const OPERATIONAL_TABLES = [
  "comment_notes",
  "comment_responses",
  "comments",
  "social_posts",
  "social_accounts",
  "ai_analyses",
  "ai_briefings",
  "ai_suggestions",
  "volunteer_tasks",
  "volunteer_attendance",
  "volunteer_checkins",
  "volunteers",
  "contact_interactions",
  "donations",
  "contacts",
  "event_photos",
  "event_checkins",
  "event_attendees",
  "campaign_events",
  "incident_media",
  "incident_reports",
  "election_results",
  "agent_reports",
  "polling_unit_status",
  "messages",
  "message_campaigns",
  "message_templates",
  "notifications",
  "activities",
  "audit_logs",
  "tenant_settings",
  "campaign_locations",
];

/** Wipe sample/operational rows. Keeps polling units and logged-in users. */
export async function zeroCampaignData() {
  try {
    const adminUser = await requirePermission("admin.users");
    if (adminUser.role !== "super_administrator") {
      return { error: "Only a super administrator can reset campaign data" };
    }

    const admin = createServiceClient();
    const tenantId = adminUser.profile.tenant_id;

    const rpc = await admin.rpc("zero_operational_campaign_data");
    if (!rpc.error) {
      const puCount = Number((rpc.data as { polling_units?: number } | null)?.polling_units ?? 0);
      await logAudit("admin.zero_campaign", "tenant", tenantId, { pollingUnits: puCount });
      revalidatePath("/dashboard");
      revalidatePath("/admin");
      revalidatePath("/volunteers");
      revalidatePath("/crm");
      revalidatePath("/events");
      revalidatePath("/comments");
      revalidatePath("/social");
      revalidatePath("/communications");
      revalidatePath("/analytics");
      revalidatePath("/sentiment");
      revalidatePath("/situation-room");
      revalidatePath("/ai");
      revalidatePath("/reports");
      return {
        success: true as const,
        pollingUnits: puCount,
        message: `Campaign data cleared. ${puCount} polling units kept. Your login was not removed.`,
      };
    }

    const missingFn = /could not find the function|schema cache/i.test(rpc.error.message);

    const { count: puBefore, error: puCountError } = await admin
      .from("polling_units")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId);
    if (puCountError) return { error: puCountError.message };

    for (const table of OPERATIONAL_TABLES) {
      const { error } = await admin.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (error && !/schema cache|does not exist/i.test(error.message)) {
        return { error: `${table}: ${error.message}` };
      }
    }

    const { error: tenantError } = await admin
      .from("tenants")
      .update({
        name: "Campaign",
        slug: "campaign",
        logo_url: null,
        election_date: null,
        campaign_end_date: null,
        fundraising_goal: 0,
      })
      .eq("id", tenantId);
    if (tenantError) return { error: tenantError.message };

    const { count: puAfter, error: puAfterError } = await admin
      .from("polling_units")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId);
    if (puAfterError) return { error: puAfterError.message };
    if ((puAfter ?? 0) !== (puBefore ?? 0)) {
      return { error: `Polling unit count changed (${puBefore} → ${puAfter})` };
    }

    await logAudit("admin.zero_campaign", "tenant", tenantId, { pollingUnits: puAfter });
    revalidatePath("/dashboard");
    revalidatePath("/admin");
    revalidatePath("/volunteers");
    revalidatePath("/crm");
    revalidatePath("/events");
    revalidatePath("/comments");
    revalidatePath("/social");
    revalidatePath("/communications");
    revalidatePath("/analytics");
    revalidatePath("/sentiment");
    revalidatePath("/situation-room");
    revalidatePath("/ai");
    revalidatePath("/reports");

    return {
      success: true as const,
      pollingUnits: puAfter ?? 0,
      message: missingFn
        ? `Campaign data cleared. ${puAfter ?? 0} polling units kept. (Run the SQL function migration for a faster reset next time.)`
        : `Campaign data cleared. ${puAfter ?? 0} polling units kept. Your login was not removed.`,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Reset failed" };
  }
}
