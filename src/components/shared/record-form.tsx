"use client";

import { Button } from "@/components/ui/button";

interface ConfirmDeleteProps {
  title: string;
  description?: string;
  onConfirm: () => void;
  pending?: boolean;
}

export function ConfirmDelete({ title, description, onConfirm, pending }: ConfirmDeleteProps) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
      <p className="font-medium">{title}</p>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      <Button type="button" variant="destructive" size="sm" className="mt-3" disabled={pending} onClick={onConfirm}>
        {pending ? "Deleting…" : "Delete"}
      </Button>
    </div>
  );
}
