"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/components/providers/auth-provider";

export function FacebookSyncButton() {
  const { canWrite } = usePermissions();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  if (!canWrite) return null;

  async function handleSync() {
    setLoading(true);
    try {
      const res = await fetch("/api/sync/facebook", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        const msg = data.error ?? "Sync failed";
        const full = typeof msg === "string" ? msg : msg;
        toast.error(full, { duration: 12000 });
        return;
      }

      const demo = data.tokenSource === "demo" || data.demo;
      const named = Number(data.authorsNamed ?? 0);
      const hidden = Number(data.authorsHidden ?? 0);
      toast.success(
        demo
          ? `Loaded ${data.postsSynced} demo posts for ${data.pageName} (connect a live page token to sync real Facebook)`
          : `Synced ${data.postsSynced} live posts from ${data.pageName} (${data.followers?.toLocaleString()} followers)` +
            (named ? `. Recovered ${named} commenter name${named === 1 ? "" : "s"}` : "")
      );
      if (!demo && hidden > 0 && named === 0) {
        toast.warning(
          `Facebook is still hiding ${hidden} visitor name${hidden === 1 ? "" : "s"}. Open Comments for the Meta App Review steps, or use Set name.`,
          { duration: 10000 }
        );
      }

      if (data.warning) {
        toast.warning(data.warning, { duration: 8000 });
      }

      router.refresh();
    } catch {
      toast.error("Could not connect to Facebook. Check your .env.local settings.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button onClick={handleSync} disabled={loading}>
      {loading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <RefreshCw className="mr-2 h-4 w-4" />
      )}
      Sync Facebook Now
    </Button>
  );
}
