import { cn } from "@/lib/utils";

/** Official NDC logo aspect ratio (source asset is 70×81). */
const NDC_LOGO_RATIO = 70 / 81;

export function NdcLogo({
  size = 64,
  className,
  priority: _priority = false,
}: {
  /** Render height in CSS pixels; width follows the official logo ratio. */
  size?: number;
  className?: string;
  priority?: boolean;
}) {
  const height = size;
  const width = Math.round(size * NDC_LOGO_RATIO);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/ndc-logo.png"
      alt="NDC — Service to the People"
      width={width}
      height={height}
      className={cn("select-none object-contain", className)}
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
      <NdcLogo size={36} className="shrink-0" />
      {showName ? (
        <div className="min-w-0 leading-tight">
          <p className="text-xs font-semibold tracking-wide text-[#1e3a8a] dark:text-[#93c5fd]">
            NDC
          </p>
          <p className="truncate text-[10px] text-muted-foreground">Service to the People</p>
        </div>
      ) : null}
    </div>
  );
}
