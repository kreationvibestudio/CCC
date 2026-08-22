import { randomBytes } from "crypto";
import type { UserRole } from "@/types/auth";
import type { createServiceClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createServiceClient>;

export function newInviteToken() {
  return randomBytes(24).toString("base64url");
}

/** PostgREST / Postgres when a table or type was never migrated. */
export function isMissingRelationError(message: string | undefined, relation: string) {
  if (!message) return false;
  const haystack = message.toLowerCase();
  const name = relation.toLowerCase();
  return haystack.includes(name) && (
    haystack.includes("schema cache") ||
    haystack.includes("does not exist") ||
    haystack.includes("pgrst205")
  );
}

function escapeIlikeExact(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/[%_]/g, (ch) => `\\${ch}`);
}

export async function createTenantInvite(
  admin: Admin,
  input: {
    tenantId: string;
    email: string;
    role: UserRole;
    invitedBy?: string | null;
    daysValid?: number;
    token?: string;
  }
) {
  const token = input.token ?? newInviteToken();
  const days = input.daysValid ?? 14;
  const { error } = await admin.from("tenant_invites").insert({
    tenant_id: input.tenantId,
    email: input.email.trim().toLowerCase(),
    role: input.role,
    token,
    invited_by: input.invitedBy ?? null,
    expires_at: new Date(Date.now() + days * 86400000).toISOString(),
  });
  if (error) return { error: error.message, token: null as string | null };
  return { token, error: null as string | null };
}

async function findAuthUserIdByEmail(email: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const res = await fetch(`${url}/auth/v1/admin/users?filter=${encodeURIComponent(email)}`, {
    headers: { Authorization: `Bearer ${key}`, apikey: key },
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { users?: { id: string; email?: string }[] };
  const match = (body.users ?? []).find((user) => user.email?.toLowerCase() === email);
  return match?.id ?? null;
}

export async function createInvitedAuthUser(
  admin: Admin,
  input: {
    tenantId: string;
    email: string;
    fullName: string;
    role: UserRole;
    password: string;
    invitedBy?: string | null;
  }
) {
  const email = input.email.trim().toLowerCase();
  const { data: matches, error: lookupError } = await admin
    .from("profiles")
    .select("id, tenant_id, email")
    .ilike("email", escapeIlikeExact(email))
    .limit(5);
  if (lookupError && !isMissingRelationError(lookupError.message, "profiles")) {
    return { error: lookupError.message };
  }
  const existing = (matches ?? []).find((row) => row.email?.toLowerCase() === email) ?? matches?.[0];
  if (existing && existing.tenant_id !== input.tenantId) {
    return { error: "This email already belongs to another campaign workspace" };
  }
  if (existing) {
    return { userId: existing.id as string, created: false as const };
  }

  const invited = await createTenantInvite(admin, {
    tenantId: input.tenantId,
    email,
    role: input.role,
    invitedBy: input.invitedBy,
  });
  if (invited.error && !isMissingRelationError(invited.error, "tenant_invites")) {
    return { error: invited.error };
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: {
      full_name: input.fullName,
      tenant_id: input.tenantId,
      role: input.role,
      ...(invited.token ? { invite_token: invited.token } : {}),
    },
  });
  if (error || !data.user) {
    const already = /already (been )?registered|already exists|duplicate/i.test(error?.message ?? "");
    if (already) {
      const userId = await findAuthUserIdByEmail(email);
      if (userId) return { userId, created: false as const };
    }
    return { error: error?.message ?? "Could not create login" };
  }
  return { userId: data.user.id, created: true as const, inviteToken: invited.token ?? undefined };
}

export async function getInviteByToken(admin: Admin, token: string) {
  const trimmed = token.trim();
  if (trimmed.length < 16) return null;
  const { data, error } = await admin
    .from("tenant_invites")
    .select("id, tenant_id, email, role, expires_at, used_at, tenants(name, slug)")
    .eq("token", trimmed)
    .maybeSingle();
  if (error && isMissingRelationError(error.message, "tenant_invites")) return null;
  if (!data || data.used_at) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) return null;
  const tenants = data.tenants as { name: string; slug: string } | { name: string; slug: string }[] | null;
  const tenant = Array.isArray(tenants) ? tenants[0] : tenants;
  return {
    id: data.id as string,
    tenantId: data.tenant_id as string,
    email: data.email as string,
    role: data.role as UserRole,
    tenantName: tenant?.name ?? "Campaign",
    tenantSlug: tenant?.slug ?? "",
  };
}
