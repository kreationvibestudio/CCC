"use client";

import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { SupportBanner } from "@/components/platform/support-banner";
import { useAuth } from "@/components/providers/auth-provider";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = useAuth();
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        {user?.supportAccess && <SupportBanner tenantName={user.supportAccess.tenantName} />}
        <Header />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
