import { headers } from "next/headers";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import type { UserRole, Permission } from "@/types/auth";
import { hasPermission, hasAnyPermission, ROLE_PERMISSIONS } from "@/types/auth";
import type { Profile } from "@/types/database";
import { platformOperatorEmails } from "@/lib/tenancy";
import { parseBearer } from "@/lib/auth/bearer";

export type WorkspaceInfo = {
  id: string;
  name: string;
  slug: string;
  party: string;
  /** The campaign's own public site, if HQ has recorded one. */
  website: string;
};

export type SupportAccess = {
  sessionId: string;
  tenantId: string;
  tenantName: string;
  expiresAt: string;
};

export interface AuthUser {
  id: string;
  email: string;
  profile: Profile;
  role: UserRole;
  permissions: Permission[];
  workspace: WorkspaceInfo | null;
  isPlatformOperator: boolean;
  supportAccess: SupportAccess | null;
}

/**
 * Claim the first platform operator seat from PLATFORM_OPERATOR_EMAILS.
 *
 * Support sessions FK onto platform_operators, so an allowlisted operator needs
 * a real row. This only writes one while the table is still empty: after that,
 * seats are granted explicitly with addPlatformOperator(), so a leaked or
 * mistyped allowlist entry cannot silently mint console access on an instance
 * that already has operators.
 */
async function claimBootstrapOperatorSeat(userId: string, email: string) {
  try {
    const admin = createServiceClient();
    const { count } = await admin
      .from("platform_operators")
      .select("user_id", { count: "exact", head: true });
    if ((count ?? 0) > 0) return false;
    const { error } = await admin.from("platform_operators").upsert(
      { user_id: userId, email: email.toLowerCase() },
      { onConflict: "user_id" }
    );
    return !error;
  } catch {
    return false;
  }
}

export async function isPlatformOperatorUser(
  userId: string,
  email: string,
  db?: SupabaseClient
): Promise<boolean> {
  const supabase = db ?? (await createClient());
  const { data } = await supabase
    .from("platform_operators")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (data) return true;
  if (!platformOperatorEmails().includes(email.toLowerCase())) return false;
  await claimBootstrapOperatorSeat(userId, email);
  return true;
}

async function loadWorkspace(tenantId: string): Promise<WorkspaceInfo | null> {
  const supabase = await createClient();
  const [{ data: tenant }, { data: settings }] = await Promise.all([
    supabase.from("tenants").select("id, name, slug").eq("id", tenantId).maybeSingle(),
    supabase
      .from("tenant_settings")
      .select("key, value")
      .eq("tenant_id", tenantId)
      .in("key", ["campaign_party", "campaign_website"]),
  ]);

  const byKey = new Map((settings ?? []).map((row) => [row.key as string, row.value]));
  const party = partyCode(byKey.get("campaign_party"));
  const website = campaignWebsite(byKey.get("campaign_website"));

  if (!tenant) {
    try {
      const admin = createServiceClient();
      const { data } = await admin.from("tenants").select("id, name, slug").eq("id", tenantId).maybeSingle();
      if (!data) return null;
      return { id: data.id, name: data.name, slug: data.slug, party, website };
    } catch {
      return null;
    }
  }
  return {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    party,
    website,
  };
}

/**
 * The HQ screens used to link a single campaign's site by name. Each workspace
 * now supplies its own, and an unset or non-https value renders as plain text
 * rather than a link to somebody else's campaign.
 */
function campaignWebsite(value: unknown): string {
  let raw = "";
  if (typeof value === "string") raw = value.trim();
  else if (value && typeof value === "object") {
    const row = value as Record<string, unknown>;
    if (typeof row.url === "string") raw = row.url.trim();
    else if (typeof row.value === "string") raw = row.value.trim();
  }
  if (!raw) return "";
  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString().replace(/\/$/, "") : "";
  } catch {
    return "";
  }
}

function partyCode(value: unknown) {
  if (typeof value === "string" && value.trim()) return value.trim().toUpperCase();
  if (value && typeof value === "object" && "party" in value) {
    return String((value as { party: string }).party).toUpperCase();
  }
  return "";
}

async function loadSupportAccess(userId: string, db?: SupabaseClient): Promise<SupportAccess | null> {
  const supabase = db ?? (await createClient());
  const { data } = await supabase
    .from("platform_support_sessions")
    .select("id, tenant_id, expires_at, tenants(name)")
    .eq("operator_id", userId)
    .is("ended_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const tenants = data.tenants as { name: string } | { name: string }[] | null;
  const tenant = Array.isArray(tenants) ? tenants[0] : tenants;
  return {
    sessionId: data.id,
    tenantId: data.tenant_id,
    tenantName: tenant?.name ?? "Workspace",
    expiresAt: data.expires_at,
  };
}

function syntheticSupportProfile(userId: string, email: string, tenantId: string): Profile {
  return {
    id: userId,
    tenant_id: tenantId,
    email,
    full_name: "Platform support",
    mfa_enabled: false,
    created_at: new Date().toISOString(),
    role: "super_administrator",
  };
}

async function assembleAuthUser(user: User, db: SupabaseClient): Promise<AuthUser | null> {
  const email = user.email ?? "";
  const isOperator = await isPlatformOperatorUser(user.id, email, db);
  const supportAccess = isOperator ? await loadSupportAccess(user.id, db) : null;

  const { data: profile } = await db.from("profiles").select("*").eq("id", user.id).single();

  if (!profile) {
    if (!isOperator || !supportAccess) return null;
    const workspace = await loadWorkspace(supportAccess.tenantId);
    const synth = syntheticSupportProfile(user.id, email, supportAccess.tenantId);
    return {
      id: user.id,
      email,
      profile: synth,
      role: "super_administrator",
      permissions: ROLE_PERMISSIONS.super_administrator ?? [],
      workspace,
      isPlatformOperator: true,
      supportAccess,
    };
  }

  const effectiveTenantId = supportAccess?.tenantId ?? profile.tenant_id;
  const role = (supportAccess ? "super_administrator" : profile.role) as UserRole;
  const workspace = await loadWorkspace(effectiveTenantId);

  return {
    id: user.id,
    email: user.email ?? profile.email,
    profile: { ...(profile as Profile), tenant_id: effectiveTenantId },
    role,
    permissions: ROLE_PERMISSIONS[role] ?? [],
    workspace,
    isPlatformOperator: isOperator,
    supportAccess,
  };
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  let bearer: string | null = null;
  try {
    bearer = parseBearer((await headers()).get("authorization"));
  } catch {
    bearer = null;
  }

  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = bearer ? await supabase.auth.getUser(bearer) : await supabase.auth.getUser();
  if (error || !user) return null;
  return assembleAuthUser(user, supabase);
}

export async function requireAuth(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

export async function requirePermission(permission: Permission): Promise<AuthUser> {
  const user = await requireAuth();
  if (!hasPermission(user.role, permission)) throw new Error("Forbidden");
  return user;
}

export const FORBIDDEN_MESSAGE = "Your role does not allow that action";

export type ActionGate = { ok: true; user: AuthUser } | { ok: false; error: string };

/**
 * Permission gate for Server Actions.
 *
 * Hiding a nav item in the dashboard layout is not an authorization boundary:
 * every `"use server"` export is directly invocable by any signed-in user, so
 * mutating actions must check permissions themselves. Returns `{ error }`
 * rather than throwing so callers keep surfacing friendly messages.
 *
 * Passing several permissions means "any of", matching how a capability can be
 * reached by more than one role.
 */
export async function authorize(...permissions: Permission[]): Promise<ActionGate> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Unauthorized" };
  if (permissions.length > 0 && !hasAnyPermission(user.role, permissions)) {
    return { ok: false, error: FORBIDDEN_MESSAGE };
  }
  return { ok: true, user };
}

export async function requirePlatformOperator(): Promise<{ id: string; email: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) throw new Error("Unauthorized");
  const ok = await isPlatformOperatorUser(user.id, user.email);
  if (!ok) throw new Error("Forbidden");
  return { id: user.id, email: user.email };
}

/** Auth shell for /platform when the operator has no campaign profile yet. */
export function platformOperatorShellUser(operator: {
  id: string;
  email: string;
}): AuthUser {
  return {
    id: operator.id,
    email: operator.email,
    profile: {
      id: operator.id,
      tenant_id: operator.id,
      email: operator.email,
      full_name: "Platform operator",
      mfa_enabled: false,
      created_at: new Date().toISOString(),
      role: "super_administrator",
    },
    role: "super_administrator",
    // No HQ permissions until they open a workspace (or have a real profile).
    permissions: [],
    workspace: null,
    isPlatformOperator: true,
    supportAccess: null,
  };
}

/** Prefer the real session user; fall back to a platform-only shell. */
export async function getPlatformConsoleUser(): Promise<AuthUser> {
  const operator = await requirePlatformOperator();
  return (await getCurrentUser()) ?? platformOperatorShellUser(operator);
}

export async function logAudit(
  action: string,
  resourceType?: string,
  resourceId?: string,
  metadata?: Record<string, unknown>
) {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return;

  await supabase.from("audit_logs").insert({
    tenant_id: user.profile.tenant_id,
    user_id: user.id,
    action,
    resource_type: resourceType,
    resource_id: resourceId,
    metadata: metadata ?? {},
  });
}
