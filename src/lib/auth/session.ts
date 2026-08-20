import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import type { UserRole, Permission } from "@/types/auth";
import { hasPermission, ROLE_PERMISSIONS } from "@/types/auth";
import type { Profile } from "@/types/database";
import { platformOperatorEmails } from "@/lib/tenancy";

export type WorkspaceInfo = {
  id: string;
  name: string;
  slug: string;
  party: string;
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

async function ensurePlatformOperatorRow(userId: string, email: string) {
  const allowed = platformOperatorEmails();
  if (!allowed.includes(email.toLowerCase())) return false;
  try {
    const admin = createServiceClient();
    await admin.from("platform_operators").upsert(
      { user_id: userId, email: email.toLowerCase() },
      { onConflict: "user_id" }
    );
    return true;
  } catch {
    return false;
  }
}

export async function isPlatformOperatorUser(userId: string, email: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("platform_operators")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (data) return true;
  return ensurePlatformOperatorRow(userId, email);
}

async function loadWorkspace(tenantId: string): Promise<WorkspaceInfo | null> {
  const supabase = await createClient();
  const [{ data: tenant }, { data: partySetting }] = await Promise.all([
    supabase.from("tenants").select("id, name, slug").eq("id", tenantId).maybeSingle(),
    supabase
      .from("tenant_settings")
      .select("value")
      .eq("tenant_id", tenantId)
      .eq("key", "campaign_party")
      .maybeSingle(),
  ]);
  if (!tenant) {
    try {
      const admin = createServiceClient();
      const { data } = await admin.from("tenants").select("id, name, slug").eq("id", tenantId).maybeSingle();
      if (!data) return null;
      return { id: data.id, name: data.name, slug: data.slug, party: partyCode(partySetting?.value) };
    } catch {
      return null;
    }
  }
  return {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    party: partyCode(partySetting?.value),
  };
}

function partyCode(value: unknown) {
  if (typeof value === "string" && value.trim()) return value.trim().toUpperCase();
  if (value && typeof value === "object" && "party" in value) {
    return String((value as { party: string }).party).toUpperCase();
  }
  return "";
}

async function loadSupportAccess(userId: string): Promise<SupportAccess | null> {
  const supabase = await createClient();
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

export async function getCurrentUser(): Promise<AuthUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const email = user.email ?? "";
  const isOperator = await isPlatformOperatorUser(user.id, email);
  const supportAccess = isOperator ? await loadSupportAccess(user.id) : null;

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();

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
