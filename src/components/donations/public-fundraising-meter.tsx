"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { formatCurrency } from "@/lib/utils";
import { publicFundraisingBarPercent, publicFundraisingPercentLabel } from "@/lib/donations/summary";
import { LiveNumber } from "@/components/situation-room/situation-room-charts";

export function PublicFundraisingMeter({
  raised,
  goal,
  prominent = false,
}: {
  raised: number;
  goal: number;
  /** Hero-scale meter for the public donate page. */
  prominent?: boolean;
}) {
  if (!(goal > 0)) return null;
  const label = publicFundraisingPercentLabel(raised, goal);
  const bar = publicFundraisingBarPercent(raised, goal);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const id = window.requestAnimationFrame(() => setWidth(bar));
    return () => window.cancelAnimationFrame(id);
  }, [bar]);

  const pctValue = Number.parseInt(label.replace(/\D/g, ""), 10);
  const showLivePct = Number.isFinite(pctValue) && label.endsWith("%") && !label.startsWith("<");

  if (prominent) {
    return (
      <div className="w-full max-w-md space-y-3 text-left">
        <div className="flex items-end justify-between gap-3">
          <p className="text-3xl font-bold tracking-tight tabular-nums sm:text-4xl">
            {showLivePct ? (
              <>
                <LiveNumber value={pctValue} />%
              </>
            ) : (
              label
            )}
            <span className="ml-2 text-base font-medium text-muted-foreground">raised</span>
          </p>
          <p className="pb-1 text-sm text-muted-foreground">{formatCurrency(goal)} goal</p>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-foreground/10" aria-hidden>
          <motion.div
            className="h-full rounded-full bg-emerald-500"
            initial={{ width: 0 }}
            animate={{ width: `${width}%` }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 pt-1 text-left">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <p className="font-medium text-foreground">{label} raised</p>
        <p className="text-muted-foreground">{formatCurrency(goal)} goal</p>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${bar}%` }} />
      </div>
    </div>
  );
}
