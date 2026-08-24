"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Landmark } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type SyncResponse = {
  success?: boolean;
  error?: string;
  state?: string;
  processed?: number;
  inserted?: number;
  updated?: number;
  failed?: number;
  nextOffset?: number;
  stateTotal?: number;
  stateRemaining?: number;
  nextState?: string | null;
  done?: boolean;
};

export function SyncInecRegisterButton() {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState("");

  async function run() {
    setRunning(true);
    setProgress("Downloading INEC register…");
    let inserted = 0;
    let updated = 0;
    let failed = 0;
    let state: string | undefined;
    let offset = 0;
    try {
      for (let i = 0; i < 900; i += 1) {
        const res = await fetch("/api/polling-units/sync-inec", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ state, offset, limit: 250 }),
        });
        const data = (await res.json()) as SyncResponse;
        if (!res.ok) {
          toast.error(data.error || "Could not load the INEC register");
          break;
        }
        inserted += data.inserted ?? 0;
        updated += data.updated ?? 0;
        failed += data.failed ?? 0;
        const loaded = (data.stateTotal ?? 0) - (data.stateRemaining ?? 0);
        setProgress(
          `${data.state ?? ""} ${loaded.toLocaleString()} / ${(data.stateTotal ?? 0).toLocaleString()} · +${inserted.toLocaleString()} new`
        );
        if (data.done) break;
        if ((data.processed ?? 0) === 0 && !data.nextState) break;
        if ((data.stateRemaining ?? 0) > 0) {
          state = data.state;
          offset = data.nextOffset ?? 0;
        } else {
          state = data.nextState ?? undefined;
          offset = 0;
        }
      }
      if (inserted + updated > 0) {
        toast.success(
          `INEC register loaded: ${inserted.toLocaleString()} added, ${updated.toLocaleString()} codes corrected${
            failed ? `, ${failed} failed` : ""
          }`
        );
      } else if (failed > 0) {
        toast.error(`INEC sync failed for ${failed} polling units`);
      } else {
        toast("Polling units already match the INEC register");
      }
      router.refresh();
    } catch {
      toast.error("INEC sync stopped — keep this tab open and try again");
    } finally {
      setRunning(false);
      setProgress("");
    }
  }

  return (
    <Button type="button" variant="default" disabled={running} onClick={() => void run()}>
      <Landmark className="mr-2 h-4 w-4" />
      {running ? progress || "Loading INEC register…" : "Load official INEC PUs"}
    </Button>
  );
}
