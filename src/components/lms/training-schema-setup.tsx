"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getVolunteerTrainingSql } from "@/lib/volunteers/actions";

const SQL_EDITOR =
  "https://supabase.com/dashboard/project/ffccfeodymiwwqshphmh/sql/new";

export function TrainingSchemaSetup({ message }: { message: string }) {
  const [pending, start] = useTransition();

  function copySql() {
    start(async () => {
      const result = await getVolunteerTrainingSql();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      await navigator.clipboard.writeText(result.sql);
      toast.success("SQL copied. Paste it in the Supabase SQL editor, Run, then refresh this page.");
    });
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="text-2xl font-bold">Training Management</h1>
      <p className="text-sm text-muted-foreground">{message}</p>
      <p className="text-sm text-muted-foreground">
        Production does not load sample volunteers or fake certificates. Apply the LMS schema once,
        then this page shows real enrollments from your campaign.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={copySql} disabled={pending}>
          {pending ? "Copying…" : "Copy training SQL"}
        </Button>
        <Button type="button" variant="outline" asChild>
          <a href={SQL_EDITOR} target="_blank" rel="noreferrer">
            Open SQL editor
          </a>
        </Button>
      </div>
    </div>
  );
}
