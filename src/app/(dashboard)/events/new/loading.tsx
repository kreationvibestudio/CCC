import { Card, CardContent } from "@/components/ui/card";

function Bar({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-muted ${className}`} />;
}

/** Instant feedback while /events/new RSC resolves (auth + form shell). */
export default function NewEventLoading() {
  return (
    <div className="mx-auto max-w-lg space-y-6 pb-28" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading new event form…</span>
      <div className="space-y-2">
        <Bar className="h-7 w-40" />
        <Bar className="h-4 w-72" />
      </div>
      <Card>
        <CardContent className="space-y-4 pt-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Bar className="h-3 w-24" />
              <Bar className="h-9 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-4 py-3 md:px-8">
        <div className="mx-auto flex max-w-lg justify-end">
          <Bar className="h-9 w-40" />
        </div>
      </div>
    </div>
  );
}
