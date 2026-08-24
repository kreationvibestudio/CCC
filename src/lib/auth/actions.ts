"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { logAudit, isPlatformOperatorUser } from "@/lib/auth/session";
import { homePathForRole, type UserRole } from "@/types/auth";
import { CAMPAIGN_TENANT_ID } from "@/lib/campaign";
import { getInviteByToken } from "@/lib/invites";
import { redirect } from "next/navigation";

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

export async function isRegistrationOpen(): Promise<boolean> {
  return true;
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

  const supabase = await createClient();
  const firstUser = await isFirstCampaignUser();
  const role: UserRole = firstUser ? "super_administrator" : "supporter";

  const { data, error } = await supabase.auth.signUp({
    email: trimmedEmail,
    password,
    options: {
      data: {
        full_name: name,
        tenant_id: CAMPAIGN_TENANT_ID,
        role,
      },
    },
  });
  if (error) return { error: error.message };

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
