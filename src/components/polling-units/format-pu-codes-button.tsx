"use client";

import { useState } from "react";
import { Hash } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export function FormatPuCodesButton() {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState("");

  async function run() {
    setRunning(true);
    setProgress("Formatting…");
    let updated = 0;
    try {
      for (let i = 0; i < 80; i += 1) {
        const res = await fetch("/api/polling-units/normalize-codes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ limit: 200 }),
        });
        const data = (await res.json()) as { error?: string; updated?: number; remaining?: number };
        if (!res.ok) {
          toast.error(data.error || "Could not format PU codes");
          break;
        }
        updated += data.updated ?? 0;
        setProgress(`Updated ${updated.toLocaleString()}…`);
        if (!data.updated) break;
      }
      if (updated > 0) toast.success(`Formatted ${updated.toLocaleString()} polling unit codes`);
      else toast("PU codes already use STATE/LGA/WARD/PU");
      router.refresh();
    } catch {
      toast.error("Could not format PU codes");
    } finally {
      setRunning(false);
      setProgress("");
    }
  }

  return (
    <Button type="button" variant="outline" disabled={running} onClick={() => void run()}>
      <Hash className="mr-2 h-4 w-4" />
      {running ? progress || "Formatting codes…" : "Format PU codes"}
    </Button>
  );
}
