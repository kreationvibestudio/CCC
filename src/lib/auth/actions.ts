"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { logAudit, isPlatformOperatorUser } from "@/lib/auth/session";
import { homePathForRole, type UserRole } from "@/types/auth";
import { CAMPAIGN_TENANT_ID } from "@/lib/campaign";
import { getInviteByToken } from "@/lib/invites";
import { platformOperatorEmails } from "@/lib/tenancy";
import { isEnvFlagEnabled } from "@/lib/env-flags";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

export async function signIn(email: string, password: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };

  await logAudit("auth.login", "user", email);

  const user = data.user;
  if (!user) return { error: "Sign in failed" };
  if (user.email && (await isPlatformOperatorUser(user.id, user.email))) {
    const { data: profile } = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();
    if (!profile) return { success: true as const, next: "/platform" };
  }
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const role = (profile?.role ?? "supporter") as UserRole;
  return { success: true as const, next: homePathForRole(role) };
}

/**
 * Public self-service registration hands a real workspace profile to anyone who
 * can reach /register, so it stays closed unless an operator opts in with
 * ALLOW_PUBLIC_REGISTRATION. A brand new instance is the one exception: the
 * first account has to be creatable before any administrator exists to invite it.
 */
export async function isRegistrationOpen(): Promise<boolean> {
  if (isEnvFlagEnabled(process.env.ALLOW_PUBLIC_REGISTRATION)) return true;
  return isFirstCampaignUser();
}

async function isFirstCampaignUser(): Promise<boolean> {
  try {
    const admin = createServiceClient();
    const { count } = await admin.from("profiles").select("id", { count: "exact", head: true });
    return (count ?? 0) === 0;
  } catch {
    return false;
  }
}

/** Workspace that self-service signups land in. Falls back to the oldest tenant. */
async function selfServeTenantId(): Promise<string | null> {
  try {
    const admin = createServiceClient();
    const { data: seeded } = await admin
      .from("tenants")
      .select("id")
      .eq("id", CAMPAIGN_TENANT_ID)
      .maybeSingle();
    if (seeded?.id) return seeded.id;
    const { data: oldest } = await admin
      .from("tenants")
      .select("id")
      .order("created_at")
      .limit(1)
      .maybeSingle();
    return oldest?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Give a self-service signup the lowest-privilege profile. handle_new_user
 * already provisions invited and bootstrap accounts, so this only fills the gap
 * it deliberately leaves empty — and never overwrites what it decided.
 */
async function ensureSelfServeProfile(userId: string, email: string, fullName: string) {
  const tenantId = await selfServeTenantId();
  if (!tenantId) return;
  try {
    const admin = createServiceClient();
    await admin.from("profiles").upsert(
      {
        id: userId,
        tenant_id: tenantId,
        email,
        full_name: fullName,
        role: "supporter" satisfies UserRole,
      },
      { onConflict: "id", ignoreDuplicates: true }
    );
  } catch {
    // Non-fatal: the account exists, an administrator can finish provisioning.
  }
}

export async function signUp(
  email: string,
  password: string,
  fullName: string
): Promise<{ error: string } | { success: true; requiresEmailConfirmation?: boolean }> {
  const trimmedEmail = email.trim().toLowerCase();
  const name = fullName.trim();
  if (!trimmedEmail.includes("@")) return { error: "Valid email is required" };
  if (!name || name.length < 2) return { error: "Full name is required" };
  if (!password || password.length < 8) {
    return { error: "Password must be at least 8 characters" };
  }

  const signupVerdict = await checkRateLimit("publicSignup", clientIp(await headers()));
  if (!signupVerdict.allowed) {
    return { error: "Too many sign-up attempts from this connection. Try again later." };
  }

  const bootstrap = await isFirstCampaignUser();
  if (!bootstrap && !isEnvFlagEnabled(process.env.ALLOW_PUBLIC_REGISTRATION)) {
    return { error: "Registration is by invitation only. Ask an administrator for an invite link." };
  }
  // A platform operator address must be provisioned deliberately. Self-service
  // signup auto-confirms the email, so allowing it here would let anyone who
  // knows an allowlisted address claim the platform console.
  if (platformOperatorEmails().includes(trimmedEmail)) {
    return { error: "This email is reserved. Ask a platform operator to provision it." };
  }

  const supabase = await createClient();
  // Role and tenant are never taken from the client: handle_new_user resolves
  // invites and the bootstrap account, and ensureSelfServeProfile() below
  // assigns the lowest-privilege role for everyone else.
  const { data, error } = await supabase.auth.signUp({
    email: trimmedEmail,
    password,
    options: {
      data: { full_name: name },
    },
  });
  if (error) return { error: error.message };
  if (data.user) await ensureSelfServeProfile(data.user.id, trimmedEmail, name);

  let requiresEmailConfirmation = Boolean(data.user && !data.session);
  if (requiresEmailConfirmation && data.user) {
    try {
      const admin = createServiceClient();
      const { error: confirmError } = await admin.auth.admin.updateUserById(data.user.id, {
        email_confirm: true,
      });
      if (!confirmError) {
        requiresEmailConfirmation = false;
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });
        if (signInError) {
          return { success: true as const, requiresEmailConfirmation: true };
        }
      }
    } catch {
      // UI can send them to login
    }
  }

  return { success: true as const, requiresEmailConfirmation };
}

export async function signUpWithInvite(input: {
  token: string;
  email: string;
  password: string;
  fullName: string;
}) {
  const trimmedEmail = input.email.trim().toLowerCase();
  const name = input.fullName.trim();
  if (!trimmedEmail.includes("@")) return { error: "Valid email is required" };
  if (!name || name.length < 2) return { error: "Full name is required" };
  if (!input.password || input.password.length < 8) {
    return { error: "Password must be at least 8 characters" };
  }

  let invite;
  try {
    const admin = createServiceClient();
    invite = await getInviteByToken(admin, input.token);
  } catch {
    return { error: "Invitation could not be verified" };
  }
  if (!invite) return { error: "This invitation is invalid or has expired" };
  if (invite.email !== trimmedEmail) {
    return { error: `Sign up with the invited email (${invite.email})` };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: trimmedEmail,
    password: input.password,
    options: {
      data: {
        full_name: name,
        invite_token: input.token,
      },
    },
  });
  if (error) return { error: error.message };

  // handle_new_user consumes the invite, but a stale database (or a swallowed
  // trigger error) would leave the account profile-less and locked out. Re-apply
  // the tenant + role we already verified server-side from the invite ledger.
  if (data.user) {
    try {
      const admin = createServiceClient();
      await admin.from("profiles").upsert(
        {
          id: data.user.id,
          tenant_id: invite.tenantId,
          email: trimmedEmail,
          full_name: name,
          role: invite.role,
        },
        { onConflict: "id", ignoreDuplicates: true }
      );
    } catch {
      // Non-fatal: an administrator can finish provisioning from /admin.
    }
  }

  let requiresEmailConfirmation = Boolean(data.user && !data.session);
  if (requiresEmailConfirmation && data.user) {
    try {
      const admin = createServiceClient();
      const { error: confirmError } = await admin.auth.admin.updateUserById(data.user.id, {
        email_confirm: true,
      });
      if (!confirmError) {
        requiresEmailConfirmation = false;
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password: input.password,
        });
        if (signInError) {
          return { success: true as const, requiresEmailConfirmation: true };
        }
      }
    } catch {
      // UI can send them to login
    }
  }

  return { success: true as const, requiresEmailConfirmation };
}

export async function signOut() {
  const supabase = await createClient();
  await logAudit("auth.logout");
  await supabase.auth.signOut();
  redirect("/login");
}

export async function enrollMFA() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "Campaign Command Center",
  });
  if (error) return { error: error.message };
  return { data };
}

export async function verifyMFA(factorId: string, code: string) {
  const supabase = await createClient();
  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
  if (challengeError) return { error: challengeError.message };

  const { error } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code,
  });
  if (error) return { error: error.message };

  await supabase.from("profiles").update({ mfa_enabled: true }).eq("id", (await supabase.auth.getUser()).data.user?.id);
  return { success: true };
}

export async function resetPassword(email: string) {
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`,
  });
  if (error) return { error: error.message };
  return { success: true };
}

export async function updatePassword(password: string) {
  if (!password || password.length < 8) {
    return { error: "Password must be at least 8 characters" };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };
  await logAudit("auth.password_reset");
  return { success: true };
}
