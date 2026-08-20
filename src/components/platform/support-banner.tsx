"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { endSupportAccess } from "@/lib/platform/actions";
import { Button } from "@/components/ui/button";

export function SupportBanner({ tenantName }: { tenantName: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center justify-between gap-3 border-b border-amber-500/40 bg-amber-500/15 px-4 py-2 text-sm">
      <p>
        Platform support view — <span className="font-medium">{tenantName}</span>. This is audited.
      </p>
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await endSupportAccess();
            router.push("/platform");
            router.refresh();
          })
        }
      >
        End support
      </Button>
    </div>
  );
}
