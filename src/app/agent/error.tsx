"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { RouteError } from "@/components/errors/route-error";

export default function AgentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteError error={error} reset={reset} what="your polling unit assignment">
      <Button asChild variant="outline" className="w-full">
        <Link href="/agent">Back to my units</Link>
      </Button>
    </RouteError>
  );
}
