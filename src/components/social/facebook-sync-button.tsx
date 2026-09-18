"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/components/providers/auth-provider";
import {
  facebookSyncFailureMessage,
  readJsonObject,
} from "@/lib/integrations/facebook/sync-response";

export function FacebookSyncButton() {
  const { canWrite } = usePermissions();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  if (!canWrite) return null;

  async function handleSync() {
    setLoading(true);
    try {
      const res = await fetch("/api/sync/facebook", {
        method: "POST",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      const data = await readJsonObject(res);

      if (!res.ok) {
        toast.error(facebookSyncFailureMessage(res, data), { duration: 12000 });
        return;
      }

      if (!data) {
        toast.error(facebookSyncFailureMessage(res, null), { duration: 12000 });
        return;
      }

      const demo = data.tokenSource === "demo" || data.demo;
      const named = Number(data.authorsNamed ?? 0);
      const hidden = Number(data.authorsHidden ?? 0);
      toast.success(
        demo
          ? `Loaded ${data.postsSynced} demo posts for ${data.pageName} (connect a live page token to sync real Facebook)`
          : `Synced ${data.postsSynced} live posts from ${data.pageName} (${Number(data.followers ?? 0).toLocaleString()} followers)` +
            (named ? `. Recovered ${named} commenter name${named === 1 ? "" : "s"}` : "")
      );
      if (!demo && hidden > 0 && named === 0) {
        toast.warning(
          `Facebook is still hiding ${hidden} visitor name${hidden === 1 ? "" : "s"}. Open Comments for the Meta App Review steps, or use Set name.`,
          { duration: 10000 }
        );
      }

      if (typeof data.warning === "string" && data.warning) {
        toast.warning(data.warning, { duration: 8000 });
      }

      router.refresh();
    } catch {
      toast.error(
        "Could not reach Facebook sync. Check your connection, then try Page posts → Connect Facebook.",
        { duration: 12000 }
      );
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
