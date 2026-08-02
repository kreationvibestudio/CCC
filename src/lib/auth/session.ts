import { createClient } from "@/lib/supabase/server";
import type { UserRole, Permission } from "@/types/auth";
import { hasPermission, ROLE_PERMISSIONS } from "@/types/auth";
import type { Profile } from "@/types/database";

export interface AuthUser {
  id: string;
  email: string;
  profile: Profile;
  role: UserRole;
  permissions: Permission[];
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  const role = profile.role as UserRole;
  return {
    id: user.id,
    email: user.email ?? profile.email,
    profile: profile as Profile,
    role,
    permissions: ROLE_PERMISSIONS[role] ?? [],
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
