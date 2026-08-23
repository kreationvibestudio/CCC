import { randomBytes } from "crypto";
import type { UserRole } from "@/types/auth";
import type { createServiceClient } from "@/lib/supabase/admin";
import { toErrorMessage, isMissingRelationError } from "./public-error";
import { adminCreateAuthUser } from "./auth/admin-users";

type Admin = ReturnType<typeof createServiceClient>;

export function newInviteToken() {
  return randomBytes(24).toString("base64url");
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
  if (error) return { error: toErrorMessage(error, "Could not create invitation"), token: null as string | null };
  return { token, error: null as string | null };
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
  try {
    const email = input.email.trim().toLowerCase();
    const { data: matches, error: lookupError } = await admin
      .from("profiles")
      .select("id, tenant_id, email")
      .ilike("email", escapeIlikeExact(email))
      .limit(5);
    if (lookupError && !isMissingRelationError(lookupError.message, "profiles")) {
      return { error: toErrorMessage(lookupError, "Could not look up that email") };
    }
    const existing = (matches ?? []).find((row) => row.email?.toLowerCase() === email) ?? matches?.[0];
    if (existing && existing.tenant_id !== input.tenantId) {
      return { error: "This email already belongs to another campaign workspace" };
    }
    if (existing) {
      return { userId: existing.id as string, created: false as const };
    }

    let inviteToken: string | undefined;
    try {
      const invited = await createTenantInvite(admin, {
        tenantId: input.tenantId,
        email,
        role: input.role,
        invitedBy: input.invitedBy,
      });
      if (invited.error && !isMissingRelationError(invited.error, "tenant_invites")) {
        return { error: toErrorMessage(invited.error, "Could not create invitation") };
      }
      inviteToken = invited.token ?? undefined;
    } catch (e) {
      if (!isMissingRelationError(toErrorMessage(e), "tenant_invites")) {
        return { error: toErrorMessage(e, "Could not create invitation") };
      }
    }

    const created = await adminCreateAuthUser({
      email,
      password: input.password,
      fullName: input.fullName,
      tenantId: input.tenantId,
      role: input.role,
      inviteToken,
    });
    if (created.error || !created.userId) {
      return { error: toErrorMessage(created.error, "Could not create login") };
    }
    return { userId: created.userId, created: Boolean(created.created), inviteToken };
  } catch (e) {
    return { error: toErrorMessage(e, "Could not create login") };
  }
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
