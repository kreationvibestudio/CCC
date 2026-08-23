"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type GeocodeResponse = {
  success?: boolean;
  error?: string;
  processed?: number;
  geocoded?: number;
  failed?: number;
  remaining?: number;
  mapped?: number;
  total?: number;
  provider?: string;
  samples?: Array<{ code: string; status: string; lat?: number | null; lng?: number | null }>;
};

export function GeocodePinsButton({ mapped, total }: { mapped: number; total: number }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState("");
  const [remaining, setRemaining] = useState(Math.max(0, total - mapped));

  useEffect(() => {
    setRemaining(Math.max(0, total - mapped));
    void fetch("/api/polling-units/geocode")
      .then((res) => res.json() as Promise<{ remaining?: number }>)
      .then((data) => {
        if (typeof data.remaining === "number") setRemaining(data.remaining);
      })
      .catch(() => undefined);
  }, [mapped, total]);

  async function run(retryFailed: boolean) {
    setRunning(true);
    setProgress("Starting…");
    let pinned = 0;
    let missed = 0;
    try {
      for (let i = 0; i < 400; i += 1) {
        const res = await fetch("/api/polling-units/geocode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ retryFailed, limit: 8 }),
        });
        const data = (await res.json()) as GeocodeResponse;
        if (!res.ok) {
          toast.error(data.error || "Could not geocode polling units");
          break;
        }
        pinned += data.geocoded ?? 0;
        missed += data.failed ?? 0;
        const left = data.remaining ?? 0;
        setRemaining(left);
        setProgress(
          `${(data.mapped ?? 0).toLocaleString()} / ${(data.total ?? 0).toLocaleString()} pinned · ${left.toLocaleString()} left`
        );
        if (!data.processed) break;
        if (left === 0) break;
      }
      if (pinned > 0) toast.success(`Pinned ${pinned.toLocaleString()} polling unit${pinned === 1 ? "" : "s"}`);
      else if (missed > 0) toast.error(`${missed} unit${missed === 1 ? "" : "s"} could not be matched. Try Retry failed.`);
      else toast("Every polling unit already has a map pin");
      router.refresh();
    } catch {
      toast.error("Geocoding stopped — check your connection and try again");
    } finally {
      setRunning(false);
      setProgress("");
    }
  }

  const missing = remaining > 0;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant={missing ? "default" : "outline"} disabled={running} onClick={() => run(false)}>
        <MapPin className="mr-2 h-4 w-4" />
        {running ? progress || "Filling map pins…" : missing ? `Fill ${remaining.toLocaleString()} missing pins` : "Map pins complete"}
      </Button>
      {missing ? (
        <Button type="button" variant="outline" disabled={running} onClick={() => run(true)}>
          Retry failed
        </Button>
      ) : null}
    </div>
  );
}
