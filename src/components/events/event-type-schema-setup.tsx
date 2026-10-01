"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EVENT_TYPE_TEXT_MIGRATION_SQL } from "@/lib/events/event-types";

const SQL_EDITOR =
  "https://supabase.com/dashboard/project/ffccfeodymiwwqshphmh/sql/new";

export function EventTypeSchemaSetup({ message }: { message?: string }) {
  const [pending, start] = useTransition();

  function copySql() {
    start(async () => {
      await navigator.clipboard.writeText(EVENT_TYPE_TEXT_MIGRATION_SQL);
      toast.success("SQL copied. Paste in Supabase SQL editor, Run, then refresh.");
    });
  }

  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
      <p className="font-medium">One SQL apply unlocks the new event types</p>
      <p className="mt-1 text-muted-foreground">
        {message ??
          "Family, LGA, unit, and custom event types need the campaign_events.event_type column updated from enum to text."}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={copySql} disabled={pending}>
          {pending ? "Copying…" : "Copy event-type SQL"}
        </Button>
        <Button type="button" size="sm" variant="outline" asChild>
          <a href={SQL_EDITOR} target="_blank" rel="noreferrer">
            Open SQL editor
          </a>
        </Button>
      </div>
    </div>
  );
}
