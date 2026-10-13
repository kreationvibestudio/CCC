"use client";

import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { SupportBanner } from "@/components/platform/support-banner";
import { useAuth } from "@/components/providers/auth-provider";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = useAuth();
  return (
    <div className="flex h-[100dvh] max-h-[100dvh] overflow-hidden pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {user?.supportAccess && <SupportBanner tenantName={user.supportAccess.tenantName} />}
        <Header />
        <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-3 sm:p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
