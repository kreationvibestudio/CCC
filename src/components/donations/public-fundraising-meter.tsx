import { formatCurrency } from "@/lib/utils";
import { publicFundraisingBarPercent, publicFundraisingPercentLabel } from "@/lib/donations/summary";

export function PublicFundraisingMeter({ raised, goal }: { raised: number; goal: number }) {
  if (!(goal > 0)) return null;
  const label = publicFundraisingPercentLabel(raised, goal);
  const bar = publicFundraisingBarPercent(raised, goal);

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
