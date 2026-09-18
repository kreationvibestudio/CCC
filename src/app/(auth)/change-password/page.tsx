import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { mustChangePassword } from "@/lib/auth/password";
import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { homePathForRole, type UserRole } from "@/types/auth";

export default async function ChangePasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/change-password");
  if (!mustChangePassword(user)) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    redirect(homePathForRole((profile?.role ?? "supporter") as UserRole));
  }
  return <ChangePasswordForm mode="first-login" />;
}
