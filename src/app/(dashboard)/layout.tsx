import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { AuthProvider } from "@/components/providers/auth-provider";
import { DashboardLayout } from "@/components/layout/dashboard-layout";

export default async function DashboardGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <AuthProvider user={user}>
      <DashboardLayout>{children}</DashboardLayout>
    </AuthProvider>
  );
}
