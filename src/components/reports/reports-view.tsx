"use client";

import { PageHeader } from "@/components/shared/page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileSpreadsheet, FileText } from "lucide-react";

export function ReportsView() {
  return (
    <div className="space-y-6">
      <PageHeader title="Reports" description="Export campaign data to Excel and PDF" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5" />Excel Exports</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {["volunteers", "contacts", "comments", "polling-units"].map((type) => (
              <Button key={type} variant="outline" className="w-full justify-start" asChild>
                <a href={`/api/reports/export?type=${type}&format=xlsx`} download>
                  Export {type.replace("-", " ")} (.xlsx)
                </a>
              </Button>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" />Summary Report</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start" asChild>
              <a href="/api/reports/export?type=summary&format=pdf" download>Download campaign summary (PDF)</a>
            </Button>
            <p className="text-xs text-muted-foreground">Includes KPIs, sentiment breakdown, and module counts.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
