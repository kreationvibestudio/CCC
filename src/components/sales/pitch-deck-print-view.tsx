"use client";

import Link from "next/link";
import { useCallback, useRef } from "react";
import { ArrowLeft, ExternalLink, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PitchDeckPrintView() {
  const frameRef = useRef<HTMLIFrameElement>(null);

  const printDeck = useCallback(() => {
    const win = frameRef.current?.contentWindow;
    if (win) {
      try {
        win.focus();
        win.print();
        return;
      } catch {
        // Fall through.
      }
    }
    window.open("/api/sales/pitch-deck", "_blank", "noopener,noreferrer");
  }, []);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-4 py-3 print:hidden">
        <Button asChild variant="ghost" size="sm">
          <Link href="/sales">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Sales folder
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">CCC Client Pitch Deck</p>
          <p className="truncate text-xs text-muted-foreground">
            Use Print / Save PDF — images are embedded in the file.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <a href="/api/sales/pitch-deck" target="_blank" rel="noreferrer">
            <ExternalLink className="mr-1.5 h-4 w-4" />
            Open in tab
          </a>
        </Button>
        <Button type="button" size="sm" onClick={printDeck}>
          <Printer className="mr-1.5 h-4 w-4" />
          Print / Save PDF
        </Button>
      </div>
      <iframe
        ref={frameRef}
        title="CCC Client Pitch Deck"
        src="/api/sales/pitch-deck"
        className="min-h-0 w-full flex-1 border-0 bg-[#070b09]"
      />
    </div>
  );
}
