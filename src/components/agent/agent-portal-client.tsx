"use client";

import { useState, useTransition } from "react";
import { PageHeader } from "@/components/shared/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { reportIncident, submitAgentReport } from "@/lib/agent/actions";
import { toast } from "sonner";

export function AgentPortalClient() {
  const [pending, startTransition] = useTransition();
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  function getLocation() {
    navigator.geolocation?.getCurrentPosition(
      (p) => setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => toast.error("Could not get GPS location")
    );
  }

  function handleReport(formData: FormData) {
    startTransition(async () => {
      const result = await submitAgentReport(formData);
      if (result.error) toast.error(result.error);
      else toast.success("Report submitted");
    });
  }

  function handleIncident(formData: FormData) {
    if (coords) {
      formData.set("latitude", String(coords.lat));
      formData.set("longitude", String(coords.lng));
    }
    startTransition(async () => {
      const result = await reportIncident(formData);
      if (result.error) toast.error(result.error);
      else toast.success("Incident reported");
    });
  }

  return (
    <div className="mx-auto min-h-screen max-w-lg space-y-6 bg-background p-4 pb-24">
      <PageHeader title="Agent Portal" description="Polling unit reporting — works offline when cached" />
      <Button variant="outline" className="w-full" onClick={getLocation} type="button">
        {coords ? `GPS: ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}` : "Capture GPS Location"}
      </Button>

      <form action={handleReport} className="space-y-3 rounded-xl border border-border p-4">
        <p className="font-medium">Field Report</p>
        <div className="space-y-1">
          <Label htmlFor="report_type">Type</Label>
          <select id="report_type" name="report_type" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
            <option value="turnout">Turnout Update</option>
            <option value="status">PU Status</option>
            <option value="logistics">Logistics</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="content">Details</Label>
          <textarea id="content" name="content" required rows={3} className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" placeholder="Report details…" />
        </div>
        <Button type="submit" disabled={pending} className="w-full">Submit Report</Button>
      </form>

      <form action={handleIncident} className="space-y-3 rounded-xl border border-destructive/50 p-4">
        <p className="font-medium text-destructive">Report Incident</p>
        <Input name="title" placeholder="Incident title" required />
        <textarea name="description" required rows={3} className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" placeholder="Describe the incident…" />
        <select name="severity" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="is_emergency" value="true" /> Emergency
        </label>
        <Button type="submit" variant="destructive" disabled={pending} className="w-full">Report Incident</Button>
      </form>
    </div>
  );
}
