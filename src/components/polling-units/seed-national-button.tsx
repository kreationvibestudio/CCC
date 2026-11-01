"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Globe2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function SeedNationalCatalogButton() {
  const router = useRouter();
  const [running, setRunning] = useState(false);

  async function run() {
    if (
      !window.confirm(
        "Download the full Nigeria INEC polling-unit register (36 states + FCT) into the shared catalog? This can take several minutes."
      )
    ) {
      return;
    }
    setRunning(true);
    try {
      const res = await fetch("/api/polling-units/seed-national", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = (await res.json()) as {
        error?: string;
        upserted?: number;
        failed?: number;
        states?: number;
      };
      if (!res.ok) {
        toast.error(data.error || "Could not seed national catalog");
        return;
      }
      toast.success(
        `National catalog updated: ${(data.upserted ?? 0).toLocaleString()} PUs across ${data.states ?? 0} states` +
          (data.failed ? ` (${data.failed} failed)` : "")
      );
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Seed failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <Button type="button" variant="secondary" disabled={running} onClick={run}>
      <Globe2 className="mr-2 h-4 w-4" />
      {running ? "Loading Nigeria register…" : "Load all Nigeria PUs"}
    </Button>
  );
}
