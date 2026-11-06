import { cn } from "@/lib/utils";

/** NDC party mark — campaign-affiliated branding (not a third-party trademark copy). */
export function NdcLogo({
  size = 64,
  className,
  priority: _priority = false,
}: {
  size?: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/ndc-logo.svg"
      alt="NDC — Nigeria Democratic Congress"
      width={size}
      height={size}
      className={cn("select-none", className)}
      decoding="async"
    />
  );
}

/** Compact party mark for headers / lockups. */
export function NdcBadge({
  className,
  showName = true,
}: {
  className?: string;
  showName?: boolean;
}) {
  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <NdcLogo size={28} className="shrink-0" />
      {showName ? (
        <div className="min-w-0 leading-tight">
          <p className="text-xs font-semibold tracking-wide text-emerald-700 dark:text-emerald-400">
            NDC
          </p>
          <p className="truncate text-[10px] text-muted-foreground">Nigeria Democratic Congress</p>
        </div>
      ) : null}
    </div>
  );
}
