export function ProgressBar({
  value,
  label,
}: {
  value: number;
  label?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="space-y-1">
      {label ? <div className="flex justify-between text-xs text-muted-foreground"><span>{label}</span><span>{pct}%</span></div> : null}
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
