"use client";

import { RouteError } from "@/components/errors/route-error";

export default function PublicError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // No "back to dashboard" link here: these pages are reached by supporters and
  // volunteers who have no account.
  return <RouteError error={error} reset={reset} what="this page" />;
}
