import { redirect } from "next/navigation";
import { getPlatformConsoleUser } from "@/lib/auth/session";
import { AuthProvider } from "@/components/providers/auth-provider";
import { DashboardLayout } from "@/components/layout/dashboard-layout";

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  let user;
  try {
    user = await getPlatformConsoleUser();
  } catch {
    redirect("/login");
  }

  return (
    <AuthProvider user={user}>
      <DashboardLayout>
        <div className="mx-auto max-w-5xl">{children}</div>
      </DashboardLayout>
    </AuthProvider>
  );
}
