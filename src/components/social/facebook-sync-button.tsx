"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function FacebookSyncButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

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
      toast.success(
        demo
          ? `Loaded ${data.postsSynced} demo posts for ${data.pageName} (connect a live page token to sync real Facebook)`
          : `Synced ${data.postsSynced} live posts from ${data.pageName} (${data.followers?.toLocaleString()} followers)`
      );

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
