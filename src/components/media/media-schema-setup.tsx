"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getMediaContentSql } from "@/lib/media/actions";

const SQL_EDITOR =
  "https://supabase.com/dashboard/project/ffccfeodymiwwqshphmh/sql/new";

export function MediaSchemaSetup({ message }: { message: string }) {
  const [pending, start] = useTransition();

  function copySql() {
    start(async () => {
      const result = await getMediaContentSql();
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      if (!("sql" in result) || !result.sql) {
        toast.error("Could not load SQL");
        return;
      }
      await navigator.clipboard.writeText(result.sql);
      toast.success("SQL copied. Paste it in the Supabase SQL editor, Run, then refresh.");
    });
  }

  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
      <p className="font-medium">Content calendar needs one SQL apply</p>
      <p className="mt-1 text-muted-foreground">{message}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={copySql} disabled={pending}>
          {pending ? "Copying…" : "Copy media_content SQL"}
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
