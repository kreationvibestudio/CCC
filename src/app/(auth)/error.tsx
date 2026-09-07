"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { RouteError } from "@/components/errors/route-error";

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteError error={error} reset={reset} what="the sign-in page">
      <Button asChild variant="outline" className="w-full">
        <Link href="/login">Back to sign in</Link>
      </Button>
    </RouteError>
  );
}
