"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

export function SubmitButton({
  label = "Save",
  className,
  form,
}: {
  label?: string;
  className?: string;
  form?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" form={form} disabled={pending} className={className}>
      {pending ? "Saving…" : label}
    </Button>
  );
}
