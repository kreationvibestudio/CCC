import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser, isPlatformOperatorUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { hasPermission, isFieldAgentRole } from "@/types/auth";
import { NAV_ITEMS } from "@/lib/navigation";
import { AuthProvider } from "@/components/providers/auth-provider";
import { DashboardLayout } from "@/components/layout/dashboard-layout";

export default async function DashboardGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) {
    const supabase = await createClient();
    const {
      data: { user: auth },
    } = await supabase.auth.getUser();
    if (auth?.email && (await isPlatformOperatorUser(auth.id, auth.email))) {
      redirect("/platform");
    }
    redirect("/login");
  }

  if (isFieldAgentRole(user.role)) {
    redirect("/agent");
  }

  const pathname = (await headers()).get("x-pathname") ?? "";
  const match = NAV_ITEMS.filter(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
  ).sort((a, b) => b.href.length - a.href.length)[0];

  if (match && !hasPermission(user.role, match.permission)) {
    const fallback = NAV_ITEMS.find((item) => hasPermission(user.role, item.permission));
    redirect(fallback?.href ?? "/login");
  }

  return (
    <AuthProvider user={user}>
      <DashboardLayout>{children}</DashboardLayout>
    </AuthProvider>
  );
}
