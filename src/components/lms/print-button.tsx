"use client";

import { Button } from "@/components/ui/button";

export function PrintButton({ label = "Print / save" }: { label?: string }) {
  return (
    <Button className="w-full" type="button" onClick={() => window.print()}>
      {label}
    </Button>
  );
}
