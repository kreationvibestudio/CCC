"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Landmark } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type SyncResponse = {
  success?: boolean;
  error?: string;
  source?: string;
  processed?: number;
  inserted?: number;
  updated?: number;
  failed?: number;
  pruned?: number;
  nextOffset?: number;
  stateTotal?: number;
  stateRemaining?: number;
  pruneRemaining?: number;
  done?: boolean;
};

export function SyncInecRegisterButton() {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState("");

  async function run() {
    setRunning(true);
    setProgress("Polling INEC CVR…");
    let inserted = 0;
    let updated = 0;
    let failed = 0;
    let pruned = 0;
    let offset = 0;
    let pruneOnly = false;
    try {
      const pollRes = await fetch("/api/polling-units/sync-inec", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ poll: true }),
      });
      const pollData = (await pollRes.json()) as SyncResponse;
      if (pollRes.ok) {
        setProgress(`Polled ${(pollData.stateTotal ?? 0).toLocaleString()} INEC units — writing to HQ…`);
      } else {
        setProgress("INEC CVR busy — using last snapshot…");
      }

      for (let i = 0; i < 900; i += 1) {
        const res = await fetch("/api/polling-units/sync-inec", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ offset, limit: pruneOnly ? 2000 : 400, pruneOnly }),
        });
        const data = (await res.json()) as SyncResponse;
        if (!res.ok) {
          toast.error(data.error || "Could not poll INEC CVR");
          break;
        }
        inserted += data.inserted ?? 0;
        updated += data.updated ?? 0;
        failed += data.failed ?? 0;
        pruned += data.pruned ?? 0;
        const loaded = (data.stateTotal ?? 0) - (data.stateRemaining ?? 0);
        setProgress(
          pruneOnly
            ? `Removing other states… ${pruned.toLocaleString()} removed`
            : `${data.source === "github" ? "Snapshot" : "INEC CVR"} ${loaded.toLocaleString()} / ${(data.stateTotal ?? 0).toLocaleString()}`
        );
        if (data.done) break;
        if ((data.stateRemaining ?? 0) > 0) {
          offset = data.nextOffset ?? 0;
          pruneOnly = false;
        } else {
          pruneOnly = true;
          offset = 0;
        }
      }
      if (inserted + updated + pruned > 0) {
        toast.success(
          `Edo register ready: ${inserted.toLocaleString()} added, ${updated.toLocaleString()} updated${
            pruned ? `, ${pruned.toLocaleString()} non-Edo units removed` : ""
          }`
        );
      } else if (failed > 0) {
        toast.error(`Edo PU sync failed for ${failed} polling units`);
      } else {
        toast("Edo polling units already match the INEC CVR register");
      }
      router.refresh();
    } catch {
      toast.error("Edo PU sync stopped — keep this tab open and try again");
    } finally {
      setRunning(false);
      setProgress("");
    }
  }

  return (
    <Button type="button" variant="default" disabled={running} onClick={() => void run()}>
      <Landmark className="mr-2 h-4 w-4" />
      {running ? progress || "Loading Edo PUs…" : "Refresh from INEC CVR"}
    </Button>
  );
}
