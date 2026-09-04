"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";
import { readFile } from "fs/promises";
import { join } from "path";
import { requirePermission, logAudit } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/admin";
import { ROLE_LABELS, type UserRole } from "@/types/auth";
import { createInvitedAuthUser } from "@/lib/invites";
import { toErrorMessage, isMissingColumnError, isMissingRelationError } from "@/lib/public-error";
import { adminDeleteAuthUser } from "@/lib/auth/admin-users";
import { openAiConfigured } from "@/lib/ai/openai";

const ROLES = Object.keys(ROLE_LABELS) as UserRole[];
const KEEP_ROLES = new Set<string>([
  "super_administrator",
  "candidate",
  "campaign_director",
  "director_general",
]);

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
    const { data: existing } = await admin
      .from("profiles")
      .select("id, role, email")
      .eq("tenant_id", adminUser.profile.tenant_id)
      .ilike("email", email)
      .limit(5);
    const already = (existing ?? []).find((row) => row.email?.toLowerCase() === email);
    if (already && KEEP_ROLES.has(already.role) && already.role !== roleRaw) {
      return { error: `${email} is already ${already.role.replace(/_/g, " ")} — pick a different email` };
    }

    const password = tempPassword();
    const created = await createInvitedAuthUser(admin, {
      tenantId: adminUser.profile.tenant_id,
      email,
      fullName,
      role: roleRaw,
      password,
      invitedBy: adminUser.id,
    });
    if (created.error || !created.userId) {
      const raw = toErrorMessage(created.error, "Could not create that login");
      if (/database error creating new user|signup requires an invitation/i.test(raw)) {
        return {
          error: `${raw}. Paste supabase/migrations/20260823000002_handle_new_user_never_abort.sql in the Supabase SQL editor and run it, then invite again.`,
        };
      }
      return { error: raw };
    }

    const { error: profileError } = await admin.from("profiles").upsert(
      {
        id: created.userId,
        tenant_id: adminUser.profile.tenant_id,
        email,
        full_name: fullName,
        role: roleRaw,
        ward,
        lga,
      },
      { onConflict: "id" }
    );
    if (profileError) return { error: toErrorMessage(profileError, "Could not save the team profile") };

    await logAudit("admin.invite", "user", created.userId, { email, role: roleRaw });
    revalidatePath("/admin");
    revalidatePath("/polling-units/agents");
    revalidatePath("/agent");
    return {
      success: true as const,
      temporaryPassword: created.created ? password : undefined,
      message: created.created
        ? roleRaw === "polling_agent"
          ? `Invited ${email} as Field Agent. Copy the temporary password, then tie them to a polling unit under Polling units → PU Agents.`
          : `Invited ${email}. Share the temporary password securely; they should change it after first login.`
        : `Updated ${email} in this campaign workspace.`,
    };
  } catch (e) {
    return { error: toErrorMessage(e, "Invite failed") };
  }
}

export async function updateCampaignDates(formData: FormData) {
  try {
    const adminUser = await requirePermission("admin.users");
    const campaignStart = String(formData.get("campaign_start_date") ?? "").trim() || null;
    const campaignEnd = String(formData.get("campaign_end_date") ?? "").trim() || null;
    const electionDate = String(formData.get("election_date") ?? "").trim() || null;

    const admin = createServiceClient();
    const withStart = await admin
      .from("tenants")
      .update({
        campaign_start_date: campaignStart || null,
        campaign_end_date: campaignEnd || null,
        election_date: electionDate || null,
      })
      .eq("id", adminUser.profile.tenant_id);
    if (withStart.error && isMissingColumnError(withStart.error.message, "campaign_start_date")) {
      const withoutStart = await admin
        .from("tenants")
        .update({
          campaign_end_date: campaignEnd || null,
          election_date: electionDate || null,
        })
        .eq("id", adminUser.profile.tenant_id);
      if (withoutStart.error) {
        return { error: toErrorMessage(withoutStart.error, "Could not save campaign dates") };
      }
      return {
        error:
          "Campaign end and election day were saved, but campaign start needs SQL. Run supabase/migrations/20260903160000_campaign_start_date.sql in the Supabase SQL editor (or use Copy campaign dates SQL on this page).",
      };
    }
    if (withStart.error) return { error: toErrorMessage(withStart.error, "Could not save campaign dates") };

    await logAudit("admin.campaign_dates", "tenant", adminUser.profile.tenant_id, {
      campaign_start_date: campaignStart,
      campaign_end_date: campaignEnd,
      election_date: electionDate,
    });
    revalidatePath("/dashboard");
    revalidatePath("/admin");
    return { success: true as const };
  } catch (e) {
    return { error: toErrorMessage(e, "Could not save campaign dates") };
  }
}

export async function getCampaignDatesMigrationSql() {
  await requirePermission("admin.users");
  return `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS campaign_start_date TIMESTAMPTZ;

UPDATE tenants SET
  campaign_start_date = '2026-08-19T00:00:00+01:00',
  campaign_end_date   = '2027-01-14T23:59:59+01:00',
  election_date       = '2027-01-16T00:00:00+01:00'
WHERE slug = 'campaign';`;
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
    if (error) return { error: toErrorMessage(error, "Could not update that role") };

    await logAudit("admin.role_change", "user", userId, {
      email: existing.email,
      from: existing.role,
      to: roleRaw,
    });
    revalidatePath("/admin");
    revalidatePath("/agent");
    return { success: true as const };
  } catch (e) {
    return { error: toErrorMessage(e, "Role update failed") };
  }
}

async function clearProfileReferences(admin: ReturnType<typeof createServiceClient>, userId: string, tenantId: string) {
  await admin.from("polling_units").update({ assigned_agent_id: null }).eq("tenant_id", tenantId).eq("assigned_agent_id", userId);
  await admin.from("polling_units").update({ assigned_supervisor_id: null }).eq("tenant_id", tenantId).eq("assigned_supervisor_id", userId);
  await admin.from("comments").update({ assigned_to: null }).eq("tenant_id", tenantId).eq("assigned_to", userId);
  const revoked = await admin
    .from("agent_access_codes")
    .update({ revoked_at: new Date().toISOString() })
    .eq("profile_id", userId)
    .is("revoked_at", null);
  if (revoked.error && !isMissingRelationError(revoked.error.message, "agent_access_codes")) {
    return revoked.error.message;
  }
  return null;
}

export async function deleteTeamMembers(formData: FormData) {
  try {
    const adminUser = await requirePermission("admin.users");
    const rawIds = formData.getAll("user_ids").map((v) => String(v).trim()).filter(Boolean);
    const uniqueIds = [...new Set(rawIds)];
    if (!uniqueIds.length) return { error: "Select at least one team member to delete" };
    if (uniqueIds.includes(adminUser.id)) {
      return { error: "You cannot delete your own account" };
    }

    const admin = createServiceClient();
    const { data: rows, error: findError } = await admin
      .from("profiles")
      .select("id, email, full_name, role, tenant_id")
      .eq("tenant_id", adminUser.profile.tenant_id)
      .in("id", uniqueIds);
    if (findError) return { error: toErrorMessage(findError, "Could not load team members") };
    if (!rows?.length) return { error: "No matching team members found in this campaign" };
    if (rows.length !== uniqueIds.length) {
      return { error: "One or more selected users are not in this campaign" };
    }

    for (const row of rows) {
      if (row.role === "super_administrator" && adminUser.role !== "super_administrator") {
        return { error: `Only a super administrator can delete ${row.email}` };
      }
    }

    const deleted: string[] = [];
    for (const row of rows) {
      const clearError = await clearProfileReferences(admin, row.id, adminUser.profile.tenant_id);
      if (clearError) return { error: clearError };

      const removed = await adminDeleteAuthUser(row.id);
      if (removed.error) {
        // Auth user may already be gone — still remove the profile row.
        const { error: profileError } = await admin
          .from("profiles")
          .delete()
          .eq("id", row.id)
          .eq("tenant_id", adminUser.profile.tenant_id);
        if (profileError && !/not found|0 rows/i.test(profileError.message)) {
          return { error: toErrorMessage(removed.error || profileError, `Could not delete ${row.email}`) };
        }
      }

      await logAudit("admin.delete_user", "user", row.id, {
        email: row.email,
        full_name: row.full_name,
        role: row.role,
      });
      deleted.push(row.email);
    }

    revalidatePath("/admin");
    revalidatePath("/polling-units/agents");
    revalidatePath("/agent");
    return {
      success: true as const,
      deleted: deleted.length,
      message: deleted.length === 1
        ? `Deleted ${deleted[0]}`
        : `Deleted ${deleted.length} team members`,
    };
  } catch (e) {
    return { error: toErrorMessage(e, "Could not delete team members") };
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
    openaiApiKey: openAiConfigured(),
    googleMapsKey: isLiveSecret(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY),
    mapboxToken: isLiveSecret(process.env.NEXT_PUBLIC_MAPBOX_TOKEN, 20),
    cronSecret: isLiveSecret(process.env.CRON_SECRET, 16),
    paystackSecret: isLiveSecret(process.env.PAYSTACK_SECRET_KEY, 20),
  };
}

export async function getInviteRepairSql() {
  await requirePermission("admin.users");
  return readFile(
    join(process.cwd(), "supabase/migrations/20260823000002_handle_new_user_never_abort.sql"),
    "utf8"
  );
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
  "agent_report_media",
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

    const rpc = await admin.rpc("zero_operational_campaign_data", { p_tenant_id: tenantId });
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
      const { error } = await admin.from(table).delete().eq("tenant_id", tenantId);
      if (error && !/schema cache|does not exist|column .*tenant_id/i.test(error.message)) {
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

const NON_EDO_LGAS = [
  "Ikeja",
  "Epe",
  "AMAC",
  "Lagos Island",
  "Lagos Mainland",
  "Alimosho",
  "Surulere",
  "Eti-Osa",
  "Kosofe",
  "Mushin",
  "Oshodi-Isolo",
  "Agege",
  "Ajeromi-Ifelodun",
  "Apapa",
  "Badagry",
  "Ifako-Ijaiye",
  "Ojo",
  "Shomolu",
  "Lagos",
  "Abuja",
  "FCT",
];

const NON_EDO_WARDS = ["Alausa", "Oregun", "Epe Town", "Garki", "Maitama", "Wuse", "Ikeja", "Secretariat"];

type PurgeCounts = {
  polling_units_pruned: number;
  volunteers_removed: number;
  contacts_removed: number;
  events_removed: number;
  activities_removed: number;
  comments_removed: number;
  donations_removed: number;
  remaining: number;
  done: boolean;
  sample_cleared: boolean;
};

const PRUNE_BATCH = 1000; // Supabase/PostgREST default max rows is 1000

/** Strict app-side prune — does not trust bare INEC `12/…` codes the way the older SQL helper did. */
async function pruneNonEdoPollingUnitsStrict(
  admin: ReturnType<typeof createServiceClient>,
  tenantId: string,
  limit: number
): Promise<{ pruned: number; remaining: number }> {
  const { isCampaignPollingUnit } = await import("@/lib/polling-units/scope");
  const page = Math.min(Math.max(limit, 1), 1000);

  const { data, error } = await admin
    .from("polling_units")
    .select("id, state, state_code, code, lga")
    .eq("tenant_id", tenantId)
    .not("state", "ilike", "EDO%")
    .limit(page);
  if (error) throw new Error(error.message);

  const candidates = (data ?? []) as Array<{
    id: string;
    state: string | null;
    state_code: string | null;
    code: string;
    lga: string | null;
  }>;
  const ids = candidates.filter((row) => !isCampaignPollingUnit(row)).map((row) => row.id);
  if (!ids.length) return { pruned: 0, remaining: 0 };

  const chunkSize = 50;
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const { error: resultsError } = await admin.from("election_results").delete().in("polling_unit_id", chunk);
    if (resultsError) throw new Error(resultsError.message);
    const { error: incidentsError } = await admin
      .from("incident_reports")
      .update({ polling_unit_id: null })
      .in("polling_unit_id", chunk);
    if (incidentsError) throw new Error(incidentsError.message);
    const { error: reportsError } = await admin
      .from("agent_reports")
      .update({ polling_unit_id: null })
      .in("polling_unit_id", chunk);
    if (reportsError) throw new Error(reportsError.message);
    const { error: delError } = await admin.from("polling_units").delete().eq("tenant_id", tenantId).in("id", chunk);
    if (delError) throw new Error(delError.message);
  }

  // If we deleted anything, assume more may remain (PostgREST max-rows can hide a full page).
  return { pruned: ids.length, remaining: ids.length > 0 ? 1 : 0 };
}

async function purgeSampleGeographyRows(
  admin: ReturnType<typeof createServiceClient>,
  tenantId: string
): Promise<Omit<PurgeCounts, "polling_units_pruned" | "remaining" | "done" | "sample_cleared">> {
  const { data: doomedVolunteers } = await admin
    .from("volunteers")
    .delete()
    .eq("tenant_id", tenantId)
    .or(
      [
        `lga.in.(${NON_EDO_LGAS.map((v) => `"${v}"`).join(",")})`,
        `ward.in.(${NON_EDO_WARDS.map((v) => `"${v}"`).join(",")})`,
      ].join(",")
    )
    .select("id");

  const { data: doomedContacts } = await admin
    .from("contacts")
    .select("id")
    .eq("tenant_id", tenantId)
    .or(
      [
        `lga.in.(${NON_EDO_LGAS.map((v) => `"${v}"`).join(",")})`,
        `ward.in.(${NON_EDO_WARDS.map((v) => `"${v}"`).join(",")})`,
      ].join(",")
    );

  const contactIds = (doomedContacts ?? []).map((c) => c.id as string);
  let donationsRemoved = 0;
  if (contactIds.length) {
    const { data: doomedDonations } = await admin
      .from("donations")
      .delete()
      .eq("tenant_id", tenantId)
      .in("contact_id", contactIds)
      .select("id");
    donationsRemoved = doomedDonations?.length ?? 0;
    await admin.from("contacts").delete().eq("tenant_id", tenantId).in("id", contactIds);
  }

  const { data: doomedEvents } = await admin
    .from("campaign_events")
    .delete()
    .eq("tenant_id", tenantId)
    .or(
      [
        `lga.in.(${NON_EDO_LGAS.map((v) => `"${v}"`).join(",")})`,
        `ward.in.(${NON_EDO_WARDS.map((v) => `"${v}"`).join(",")})`,
        "title.ilike.%Lagos%",
        "title.ilike.%Ikeja%",
        "title.ilike.%Epe%",
        "title.ilike.%Abuja%",
        "location.ilike.%Lagos%",
        "location.ilike.%Ikeja%",
        "location.ilike.%Epe%",
        "location.ilike.%Abuja%",
        "location.ilike.%Tafawa%",
      ].join(",")
    )
    .select("id");

  const { data: allActivities } = await admin
    .from("activities")
    .select("id, action, description")
    .eq("tenant_id", tenantId)
    .limit(2000);
  const activityIds = (allActivities ?? [])
    .filter((a) => {
      const text = `${a.action ?? ""} ${a.description ?? ""}`.toLowerCase();
      return /(ikeja|epe|lagos|abuja|alausa|oregun|tafawa|balewa|amac|garki|david okon)/.test(text);
    })
    .map((a) => a.id as string);
  if (activityIds.length) {
    await admin.from("activities").delete().in("id", activityIds);
  }

  const { data: doomedComments } = await admin
    .from("comments")
    .delete()
    .eq("tenant_id", tenantId)
    .or(
      [
        `lga.in.(${NON_EDO_LGAS.map((v) => `"${v}"`).join(",")})`,
        `ward.in.(${NON_EDO_WARDS.map((v) => `"${v}"`).join(",")})`,
        "content.ilike.%Ikeja%",
        "content.ilike.%Lagos%",
        "content.ilike.%Epe%",
        "content.ilike.%Abuja%",
      ].join(",")
    )
    .select("id");

  return {
    volunteers_removed: doomedVolunteers?.length ?? 0,
    contacts_removed: contactIds.length,
    events_removed: doomedEvents?.length ?? 0,
    activities_removed: activityIds.length,
    comments_removed: doomedComments?.length ?? 0,
    donations_removed: donationsRemoved,
  };
}

/**
 * Chunked purge so large non-Edo registers (100k+) finish under Vercel timeouts.
 * Call repeatedly with `{ continuePrune: true }` until `done` is true.
 */
export async function purgeNonEdoSampleData(options?: { continuePrune?: boolean }) {
  try {
    const adminUser = await requirePermission("admin.users");
    if (adminUser.role !== "super_administrator") {
      return { error: "Only a super administrator can purge non-Edo sample data" };
    }

    const admin = createServiceClient();
    const tenantId = adminUser.profile.tenant_id;
    const continuePrune = Boolean(options?.continuePrune);

    let sample = {
      volunteers_removed: 0,
      contacts_removed: 0,
      events_removed: 0,
      activities_removed: 0,
      comments_removed: 0,
      donations_removed: 0,
    };
    if (!continuePrune) {
      sample = await purgeSampleGeographyRows(admin, tenantId);
    }

    const batch = await pruneNonEdoPollingUnitsStrict(admin, tenantId, PRUNE_BATCH);
    const data: PurgeCounts = {
      ...sample,
      polling_units_pruned: batch.pruned,
      remaining: batch.remaining,
      done: batch.remaining === 0,
      sample_cleared: !continuePrune,
    };

    if (!continuePrune || data.polling_units_pruned > 0 || data.done) {
      await logAudit("admin.purge_non_edo", "tenant", tenantId, data);
    }
    revalidatePath("/dashboard");
    revalidatePath("/admin");
    revalidatePath("/volunteers");
    revalidatePath("/crm");
    revalidatePath("/events");
    revalidatePath("/comments");
    revalidatePath("/social");
    revalidatePath("/analytics");
    revalidatePath("/situation-room");
    revalidatePath("/maps");
    revalidatePath("/polling-units");
    revalidatePath("/reports");

    if (!data.done) {
      return {
        success: true as const,
        ...data,
        message: `Removed ${data.polling_units_pruned.toLocaleString()} non-Edo polling units this batch (more remain). Continuing…`,
      };
    }

    const parts = [
      `${data.polling_units_pruned} non-Edo polling units (final batch)`,
      `${data.volunteers_removed} volunteers`,
      `${data.contacts_removed} contacts`,
      `${data.events_removed} events`,
      `${data.comments_removed} comments`,
      `${data.activities_removed} activities`,
      `${data.donations_removed} donations`,
    ];

    return {
      success: true as const,
      ...data,
      message: continuePrune
        ? "All non-Edo polling units removed. Edo register and team accounts kept."
        : `Removed non-Edo sample data (${parts.join(", ")}). Edo polling units and team accounts were kept.`,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Purge failed" };
  }
}

export async function getPurgeNonEdoMigrationSql() {
  await requirePermission("admin.users");
  const [purgeSql, strictSql] = await Promise.all([
    readFile(join(process.cwd(), "supabase/migrations/20260904120000_purge_non_edo_sample_data.sql"), "utf8"),
    readFile(join(process.cwd(), "supabase/migrations/20260904130000_strict_edo_campaign_polling_unit.sql"), "utf8"),
  ]);
  return `${purgeSql}\n\n${strictSql}\n`;
}
