"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { RouteError } from "@/components/errors/route-error";

export default function PlatformError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteError error={error} reset={reset} what="the platform console">
      <Button asChild variant="outline" className="w-full">
        <Link href="/platform">Back to console</Link>
      </Button>
    </RouteError>
  );
}
