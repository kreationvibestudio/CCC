"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";
import { requirePlatformOperator, logAudit } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/admin";
import { CAMPAIGN_TENANT_ID, appBaseUrl } from "@/lib/campaign";
import { FEATURED_PARTIES, RESULT_PARTIES } from "@/lib/elections/parties";
import { slugifyWorkspace } from "@/lib/tenancy";
import { createInvitedAuthUser, createTenantInvite, newInviteToken } from "@/lib/invites";
import { ROLE_LABELS, type UserRole } from "@/types/auth";

function tempPassword() {
  return `${randomBytes(9).toString("base64url")}Aa1!`;
}

function partyAllowed(code: string) {
  const upper = code.toUpperCase();
  return RESULT_PARTIES.some((p) => p.code === upper) || FEATURED_PARTIES.some((p) => p.code === upper);
}

export type PlatformWorkspace = {
  id: string;
  name: string;
  slug: string;
  party: string;
  puCount: number;
  userCount: number;
  created_at: string;
};

export async function listWorkspaces(): Promise<PlatformWorkspace[]> {
  await requirePlatformOperator();
  const admin = createServiceClient();
  const { data: tenants } = await admin
    .from("tenants")
    .select("id, name, slug, created_at")
    .order("created_at");
  const rows = tenants ?? [];
  const result: PlatformWorkspace[] = [];
  for (const t of rows) {
    const [{ count: puCount }, { count: userCount }, { data: partySetting }] = await Promise.all([
      admin.from("polling_units").select("id", { count: "exact", head: true }).eq("tenant_id", t.id),
      admin.from("profiles").select("id", { count: "exact", head: true }).eq("tenant_id", t.id),
      admin
        .from("tenant_settings")
        .select("value")
        .eq("tenant_id", t.id)
        .eq("key", "campaign_party")
        .maybeSingle(),
    ]);
    let party = "";
    const val = partySetting?.value;
    if (typeof val === "string") party = val;
    else if (val && typeof val === "object" && "party" in val) party = String((val as { party: string }).party);
    result.push({
      id: t.id,
      name: t.name,
      slug: t.slug,
      party: party.toUpperCase(),
      puCount: puCount ?? 0,
      userCount: userCount ?? 0,
      created_at: t.created_at,
    });
  }
  return result;
}

export async function createWorkspace(formData: FormData) {
  try {
    const operator = await requirePlatformOperator();
    const name = String(formData.get("name") ?? "").trim();
    const slugRaw = String(formData.get("slug") ?? "").trim() || name;
    const slug = slugifyWorkspace(slugRaw);
    const party = String(formData.get("campaign_party") ?? "").trim().toUpperCase();
    const hqEmail = String(formData.get("hq_email") ?? "").trim().toLowerCase();
    const hqName = String(formData.get("hq_name") ?? "").trim() || hqEmail.split("@")[0];
    const cloneSource = String(formData.get("clone_source") ?? "").trim() || CAMPAIGN_TENANT_ID;

    if (!name) return { error: "Workspace name is required" };
    if (!slug || slug.length < 2) return { error: "Slug must be at least 2 characters" };
    if (!partyAllowed(party)) return { error: "Choose a valid party code" };
    if (!hqEmail.includes("@")) return { error: "HQ admin email is required" };

    const admin = createServiceClient();
    const { data: tenant, error } = await admin
      .from("tenants")
      .insert({ name, slug })
      .select("id, name, slug")
      .single();
    if (error || !tenant) return { error: error?.message ?? "Could not create workspace" };

    await admin.from("tenant_settings").upsert({
      tenant_id: tenant.id,
      key: "campaign_party",
      value: party,
    }, { onConflict: "tenant_id,key" });

    const password = tempPassword();
    const invited = await createInvitedAuthUser(admin, {
      tenantId: tenant.id,
      email: hqEmail,
      fullName: hqName,
      role: "super_administrator",
      password,
      invitedBy: null,
    });
    if (invited.error || !invited.userId) {
      return { error: `Workspace created but HQ invite failed: ${invited.error}` };
    }

    await admin.from("profiles").upsert({
      id: invited.userId,
      tenant_id: tenant.id,
      email: hqEmail,
      full_name: hqName,
      role: "super_administrator",
    }, { onConflict: "id" });

    let cloneNote = "Polling units were not copied.";
    const clone = await admin.rpc("clone_polling_units", {
      p_source: cloneSource,
      p_dest: tenant.id,
    });
    if (clone.error) {
      cloneNote = `Polling unit copy needs a retry (${clone.error.message}).`;
    } else {
      const copied = Number((clone.data as { copied?: number } | null)?.copied ?? 0);
      cloneNote = `Copied ${copied.toLocaleString()} polling units.`;
    }

    await logAudit("platform.create_workspace", "tenant", tenant.id, { slug, party, hqEmail });
    revalidatePath("/platform");
    const base = appBaseUrl();
    const joinToken = invited.inviteToken;
    return {
      success: true as const,
      tenantId: tenant.id,
      temporaryPassword: invited.created ? password : undefined,
      joinUrl: joinToken && base ? `${base}/join/${joinToken}` : "",
      message: `${name} is ready. ${cloneNote}`,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Create failed" };
  }
}

export async function cloneWorkspacePollingUnits(formData: FormData) {
  try {
    await requirePlatformOperator();
    const dest = String(formData.get("tenant_id") ?? "").trim();
    const source = String(formData.get("source_id") ?? "").trim() || CAMPAIGN_TENANT_ID;
    if (!dest) return { error: "Workspace is required" };
    const admin = createServiceClient();
    const clone = await admin.rpc("clone_polling_units", { p_source: source, p_dest: dest });
    if (clone.error) return { error: clone.error.message };
    const copied = Number((clone.data as { copied?: number } | null)?.copied ?? 0);
    revalidatePath("/platform");
    return { success: true as const, message: `Copied ${copied.toLocaleString()} polling units.` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Clone failed" };
  }
}

export async function inviteWorkspaceAdmin(formData: FormData) {
  try {
    const operator = await requirePlatformOperator();
    const tenantId = String(formData.get("tenant_id") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const fullName = String(formData.get("full_name") ?? "").trim() || email.split("@")[0];
    const roleRaw = String(formData.get("role") ?? "super_administrator") as UserRole;
    if (!tenantId) return { error: "Workspace is required" };
    if (!email.includes("@")) return { error: "Valid email is required" };
    if (!(roleRaw in ROLE_LABELS)) return { error: "Invalid role" };

    const admin = createServiceClient();
    const password = tempPassword();
    const invited = await createInvitedAuthUser(admin, {
      tenantId,
      email,
      fullName,
      role: roleRaw,
      password,
      invitedBy: null,
    });
    if (invited.error || !invited.userId) return { error: invited.error ?? "Invite failed" };

    await admin.from("profiles").upsert({
      id: invited.userId,
      tenant_id: tenantId,
      email,
      full_name: fullName,
      role: roleRaw,
    }, { onConflict: "id" });

    let joinUrl = "";
    if (!invited.created) {
      const token = newInviteToken();
      const extra = await createTenantInvite(admin, {
        tenantId,
        email,
        role: roleRaw,
        token,
        daysValid: 14,
      });
      const base = appBaseUrl();
      if (!extra.error && extra.token && base) joinUrl = `${base}/join/${extra.token}`;
    } else {
      const base = appBaseUrl();
      if (invited.inviteToken && base) joinUrl = `${base}/join/${invited.inviteToken}`;
    }

    await logAudit("platform.invite_hq", "user", invited.userId, { email, tenantId, operator: operator.email });
    revalidatePath("/platform");
    return {
      success: true as const,
      temporaryPassword: invited.created ? password : undefined,
      joinUrl,
      message: invited.created ? `Invited ${email}` : `Account already exists in this workspace`,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Invite failed" };
  }
}

export async function resetWorkspace(formData: FormData) {
  try {
    await requirePlatformOperator();
    const tenantId = String(formData.get("tenant_id") ?? "").trim();
    if (!tenantId) return { error: "Workspace is required" };
    const admin = createServiceClient();
    const rpc = await admin.rpc("zero_operational_campaign_data", { p_tenant_id: tenantId });
    if (rpc.error) return { error: rpc.error.message };
    const puCount = Number((rpc.data as { polling_units?: number } | null)?.polling_units ?? 0);
    await logAudit("platform.reset_workspace", "tenant", tenantId, { pollingUnits: puCount });
    revalidatePath("/platform");
    return { success: true as const, message: `Workspace operational data cleared. ${puCount} polling units kept.` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Reset failed" };
  }
}

export async function startSupportAccess(formData: FormData) {
  try {
    const operator = await requirePlatformOperator();
    const tenantId = String(formData.get("tenant_id") ?? "").trim();
    const reason = String(formData.get("reason") ?? "").trim() || "Support";
    if (!tenantId) return { error: "Workspace is required" };
    const admin = createServiceClient();
    await admin
      .from("platform_support_sessions")
      .update({ ended_at: new Date().toISOString() })
      .eq("operator_id", operator.id)
      .is("ended_at", null);

    const { error } = await admin.from("platform_support_sessions").insert({
      operator_id: operator.id,
      tenant_id: tenantId,
      reason,
      expires_at: new Date(Date.now() + 2 * 3600000).toISOString(),
    });
    if (error) return { error: error.message };
    await logAudit("platform.support_start", "tenant", tenantId, { reason, operator: operator.email });
    revalidatePath("/platform");
    revalidatePath("/dashboard");
    return { success: true as const };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not start support access" };
  }
}

export async function endSupportAccess() {
  try {
    const operator = await requirePlatformOperator();
    const admin = createServiceClient();
    await admin
      .from("platform_support_sessions")
      .update({ ended_at: new Date().toISOString() })
      .eq("operator_id", operator.id)
      .is("ended_at", null);
    await logAudit("platform.support_end", "user", operator.id);
    revalidatePath("/platform");
    revalidatePath("/dashboard");
    return { success: true as const };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not end support access" };
  }
}

export async function addPlatformOperator(formData: FormData) {
  try {
    await requirePlatformOperator();
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    if (!email.includes("@")) return { error: "Valid email is required" };
    const admin = createServiceClient();
    const { data: profile } = await admin.from("profiles").select("id, email").eq("email", email).maybeSingle();
    if (!profile) return { error: "That email must already have an account (sign in once first)" };
    const { error } = await admin.from("platform_operators").upsert(
      { user_id: profile.id, email },
      { onConflict: "user_id" }
    );
    if (error) return { error: error.message };
    revalidatePath("/platform");
    return { success: true as const, message: `${email} can open the platform console.` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not add operator" };
  }
}
