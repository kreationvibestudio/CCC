"use client";

import Link from "next/link";
import { PageHeader, EmptyState } from "@/components/shared/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FacebookCommenterNamesCard } from "@/components/social/facebook-commenter-names-card";
import type { SystemLogEntry } from "@/lib/admin/system-log";
import { formatDate } from "@/lib/utils";
import { usePermissions } from "@/components/providers/auth-provider";
import { AlertTriangle, ArrowLeft } from "lucide-react";

const LEVEL_VARIANT: Record<SystemLogEntry["level"], "warning" | "destructive" | "secondary"> = {
  warning: "warning",
  error: "destructive",
  event: "secondary",
};

export function AdminSystemLogView({ entries }: { entries: SystemLogEntry[] }) {
  const { canWrite } = usePermissions();
  const warnings = entries.filter((e) => e.level === "warning").length;
  const errors = entries.filter((e) => e.level === "error").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="System log"
        description="Admin folder for events, errors, and integration warnings — kept off work screens like Comments"
      >
        <Button variant="outline" asChild>
          <Link href="/admin">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Admin
          </Link>
        </Button>
      </PageHeader>

      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary">{entries.length} active</Badge>
        <Badge variant="warning">{warnings} warning{warnings === 1 ? "" : "s"}</Badge>
        <Badge variant="destructive">{errors} error{errors === 1 ? "" : "s"}</Badge>
      </div>

      {entries.length === 0 ? (
        <EmptyState
          title="No active warnings"
          description="Integration and system notices will appear here when something needs admin attention."
        />
      ) : (
        <div className="space-y-4">
          {entries.map((entry) => (
            <Card key={entry.id}>
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={LEVEL_VARIANT[entry.level]} className="capitalize">
                    {entry.level}
                  </Badge>
                  <Badge variant="outline">{entry.source}</Badge>
                  {entry.createdAt ? (
                    <span className="text-xs text-muted-foreground">{formatDate(entry.createdAt)}</span>
                  ) : null}
                </div>
                <CardTitle className="flex items-start gap-2 text-base font-medium leading-snug">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                  <span>{entry.title}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">{entry.summary}</p>
                {entry.href ? (
                  <Button type="button" size="sm" variant="outline" asChild>
                    <Link href={entry.href}>Open related screen</Link>
                  </Button>
                ) : null}
                {typeof entry.facebookHiddenAuthors === "number" ? (
                  <FacebookCommenterNamesCard
                    hiddenCount={entry.facebookHiddenAuthors}
                    canWrite={canWrite}
                  />
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
