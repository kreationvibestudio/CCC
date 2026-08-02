"use server";

import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export async function signIn(email: string, password: string) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };

  await logAudit("auth.login", "user", email);
  return { success: true };
}

export async function signUp(email: string, password: string, fullName: string) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        tenant_id: "a0000000-0000-0000-0000-000000000001",
        role: "supporter",
      },
    },
  });
  if (error) return { error: error.message };
  return { success: true };
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
