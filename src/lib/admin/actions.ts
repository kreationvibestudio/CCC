"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";
import { requirePermission, logAudit } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/admin";
import { ROLE_LABELS, type UserRole } from "@/types/auth";

const ROLES = Object.keys(ROLE_LABELS) as UserRole[];

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
    const password = tempPassword();
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        tenant_id: adminUser.profile.tenant_id,
        role: roleRaw,
      },
    });
    if (error) return { error: error.message };
    if (!data.user) return { error: "User creation failed" };

    const { error: profileError } = await admin.from("profiles").upsert(
      {
        id: data.user.id,
        tenant_id: adminUser.profile.tenant_id,
        email,
        full_name: fullName,
        role: roleRaw,
        ward,
        lga,
      },
      { onConflict: "id" }
    );
    if (profileError) return { error: profileError.message };

    await logAudit("admin.invite", "user", data.user.id, { email, role: roleRaw });
    revalidatePath("/admin");
    return {
      success: true as const,
      temporaryPassword: password,
      message: `Invited ${email}. Share the temporary password securely; they should change it after first login.`,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Invite failed" };
  }
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
    if (error) return { error: error.message };

    await logAudit("admin.role_change", "user", userId, {
      email: existing.email,
      from: existing.role,
      to: roleRaw,
    });
    revalidatePath("/admin");
    return { success: true as const };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Role update failed" };
  }
}

/** Booleans only — never expose secret values to the client. */
export async function getSecretsStatus() {
  await requirePermission("admin.users");
  return {
    supabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    supabaseAnon: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    supabaseServiceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    appUrl: Boolean(process.env.NEXT_PUBLIC_APP_URL),
    termiiApiKey: Boolean(process.env.TERMII_API_KEY?.trim()),
    termiiSenderId: Boolean(process.env.TERMII_SENDER_ID?.trim()),
    facebookPageId: Boolean(
      process.env.FACEBOOK_PAGE_ID?.trim() &&
        process.env.FACEBOOK_PAGE_ID.trim() !== "[SENSITIVE]" &&
        !/^your[_-]/i.test(process.env.FACEBOOK_PAGE_ID.trim())
    ),
    facebookUserToken: Boolean(
      process.env.FACEBOOK_USER_ACCESS_TOKEN?.trim() &&
        process.env.FACEBOOK_USER_ACCESS_TOKEN.trim().length >= 40 &&
        process.env.FACEBOOK_USER_ACCESS_TOKEN.trim() !== "[SENSITIVE]"
    ),
    facebookPageToken: Boolean(
      process.env.FACEBOOK_PAGE_ACCESS_TOKEN?.trim() &&
        process.env.FACEBOOK_PAGE_ACCESS_TOKEN.trim().length >= 40 &&
        process.env.FACEBOOK_PAGE_ACCESS_TOKEN.trim() !== "[SENSITIVE]"
    ),
    facebookAppCredentials: Boolean(
      process.env.FACEBOOK_APP_ID?.trim() && process.env.FACEBOOK_APP_SECRET?.trim()
    ),
    openaiApiKey: Boolean(process.env.OPENAI_API_KEY?.trim()),
    googleMapsKey: Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim()),
  };
}
