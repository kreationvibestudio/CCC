import Link from "next/link";
import { BrandLogo } from "@/components/brand/logo";

export default function LearnLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <BrandLogo size={36} className="rounded-md" />
          <div>
            <p className="text-sm font-semibold leading-none">Campaign Command Center</p>
            <p className="text-[11px] text-muted-foreground">Volunteer Training</p>
          </div>
          <Link href="/" className="ml-auto text-xs text-muted-foreground hover:underline">HQ login</Link>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-6">{children}</main>
    </div>
  );
}
