import Link from "next/link";
import { redirect } from "next/navigation";
import { FolderOpen, Download, Printer, ExternalLink, FileText } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { canAccessPitchDeck } from "@/lib/pitch-deck/access";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function SalesFolderPage() {
  const user = await getCurrentUser();
  if (!user || !canAccessPitchDeck(user)) {
    redirect("/dashboard");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
          <FolderOpen className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sales</h1>
          <p className="text-sm text-muted-foreground">
            Private client materials — visible only to you as Super Administrator.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start gap-3">
            <FileText className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1 space-y-1">
              <CardTitle className="text-base">CCC Client Pitch Deck</CardTitle>
              <CardDescription>
                9-slide deck with pricing (Local ₦3.5M · State ₦9.5M · Command from ₦18M).
                Images are embedded so Print and Download keep every visual.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild>
            <a href="/api/sales/pitch-deck" target="_blank" rel="noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" />
              Open deck
            </a>
          </Button>
          <Button asChild variant="secondary">
            <a href="/api/sales/pitch-deck?download=1">
              <Download className="mr-2 h-4 w-4" />
              Download HTML
            </a>
          </Button>
          <Button asChild variant="outline">
            <Link href="/sales/pitch-deck/print">
              <Printer className="mr-2 h-4 w-4" />
              Print / Save PDF
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
