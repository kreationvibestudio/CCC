"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export type RouteErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
  /** What the user was trying to reach, e.g. "the situation room". */
  what?: string;
  /** Rendered under the retry button, e.g. a link back to the dashboard. */
  children?: React.ReactNode;
};

/**
 * Shared body for the app's error boundaries.
 *
 * Never renders `error.message`: a server component throwing inside a server
 * action or a Supabase client can put table names, filters and occasionally row
 * contents in there. `digest` is Next's own hash and is safe to show — it is
 * what ties a user report to a server log line.
 */
export function RouteError({ error, reset, what = "this page", children }: RouteErrorProps) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <CardTitle>Something went wrong</CardTitle>
          <CardDescription>
            We could not load {what}. This is usually temporary — try again, and if it keeps
            happening let your administrator know.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={reset} className="w-full">
            <RotateCcw />
            Try again
          </Button>
          {children}
          {error.digest ? (
            <p className="text-center text-xs text-muted-foreground">
              Reference: <code className="font-mono">{error.digest}</code>
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
