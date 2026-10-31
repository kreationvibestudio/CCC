import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser, isPlatformOperatorUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { hasPermission, isFieldAgentRole } from "@/types/auth";
import { NAV_ITEMS } from "@/lib/navigation";
import { AuthProvider } from "@/components/providers/auth-provider";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { LicenseCountdownChip } from "@/components/admin/license-status-card";
import { getTenantLicense } from "@/lib/licensing/service";

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

  const license = user.profile.tenant_id
    ? await getTenantLicense(user.profile.tenant_id).catch(() => null)
    : null;

  // Expired/suspended licenses stay on Admin so HQ can renew; support sessions skip the gate.
  const onAdmin = pathname === "/admin" || pathname.startsWith("/admin/");
  if (
    !user.supportAccess &&
    license &&
    (license.status === "expired" || license.status === "suspended") &&
    !onAdmin
  ) {
    redirect("/admin#license");
  }

  const showLicenseChip =
    hasPermission(user.role, "admin.users") ||
    license?.status === "grace" ||
    license?.status === "expired" ||
    license?.status === "missing" ||
    !license;

  return (
    <AuthProvider user={user}>
      <DashboardLayout>{children}</DashboardLayout>
      {showLicenseChip ? <LicenseCountdownChip license={license} /> : null}
    </AuthProvider>
  );
}
