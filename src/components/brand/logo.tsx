import Image from "next/image";
import { cn } from "@/lib/utils";

export function BrandLogo({
  size = 96,
  className,
  priority = false,
}: {
  size?: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/ccc-logo.webp"
      alt="Campaign Command Center"
      width={size}
      height={size}
      priority={priority}
      className={cn("select-none", className)}
    />
  );
}
