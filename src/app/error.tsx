"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { RouteError } from "@/components/errors/route-error";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteError error={error} reset={reset}>
      <Button asChild variant="outline" className="w-full">
        <Link href="/dashboard">Back to dashboard</Link>
      </Button>
    </RouteError>
  );
}
