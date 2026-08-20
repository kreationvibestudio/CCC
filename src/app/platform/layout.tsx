import { redirect } from "next/navigation";
import { requirePlatformOperator } from "@/lib/auth/session";

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  try {
    await requirePlatformOperator();
  } catch {
    redirect("/login");
  }
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl p-4 md:p-8">{children}</div>
    </div>
  );
}
