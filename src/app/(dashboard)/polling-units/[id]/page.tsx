import { redirect } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { SubmitButton } from "@/components/forms/submit-button";
import { getPollingUnit, updatePollingUnit, deletePollingUnit, getTeamForAssignment } from "@/lib/polling-units/actions";

export default async function PollingUnitDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pu = await getPollingUnit(id);
  if (!pu) redirect("/polling-units");

  const team = await getTeamForAssignment();

  async function saveAction(formData: FormData) {
    "use server";
    const result = await updatePollingUnit(id, formData);
    if (result.error) throw new Error(result.error);
    redirect(`/polling-units/${id}`);
  }

  async function deleteAction() {
    "use server";
    await deletePollingUnit(id);
    redirect("/polling-units");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title={pu.name as string} description={pu.code as string}>
        <Button variant="outline" asChild><Link href="/polling-units">Back</Link></Button>
      </PageHeader>

      <Card>
        <CardContent className="pt-6">
          <form action={saveAction} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1"><Label htmlFor="code">PU Code</Label><Input id="code" name="code" defaultValue={pu.code as string} required /></div>
              <div className="space-y-1"><Label htmlFor="pu_code">PU code (INEC)</Label><Input id="pu_code" name="pu_code" defaultValue={(pu.pu_code as string) ?? ""} /></div>
              <div className="space-y-1"><Label htmlFor="name">Location</Label><Input id="name" name="name" defaultValue={pu.name as string} required /></div>
              <div className="space-y-1"><Label htmlFor="state">State</Label><Input id="state" name="state" defaultValue={(pu.state as string) ?? "Edo"} /></div>
              <div className="space-y-1"><Label htmlFor="state_code">State code</Label><Input id="state_code" name="state_code" defaultValue={(pu.state_code as string) ?? ""} /></div>
              <div className="space-y-1"><Label htmlFor="lg_code">LGA code</Label><Input id="lg_code" name="lg_code" defaultValue={(pu.lg_code as string) ?? ""} /></div>
              <div className="space-y-1"><Label htmlFor="ward_code">Ward code</Label><Input id="ward_code" name="ward_code" defaultValue={(pu.ward_code as string) ?? ""} /></div>
              <div className="space-y-1"><Label htmlFor="ward">Ward (ward_des)</Label><Input id="ward" name="ward" defaultValue={pu.ward as string} /></div>
              <div className="space-y-1"><Label htmlFor="lga">LGA (lg_des)</Label><Input id="lga" name="lga" defaultValue={pu.lga as string} /></div>
              <div className="space-y-1"><Label htmlFor="registered_voters">Registered voters</Label><Input id="registered_voters" name="registered_voters" type="number" defaultValue={String(pu.registered_voters ?? 0)} /></div>
              <div className="space-y-1">
                <Label htmlFor="risk_level">Risk</Label>
                <NativeSelect id="risk_level" name="risk_level" defaultValue={pu.risk_level as string}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </NativeSelect>
              </div>
              <div className="space-y-1"><Label htmlFor="latitude">Latitude</Label><Input id="latitude" name="latitude" type="number" step="any" defaultValue={pu.latitude != null ? String(pu.latitude) : ""} /></div>
              <div className="space-y-1"><Label htmlFor="longitude">Longitude</Label><Input id="longitude" name="longitude" type="number" step="any" defaultValue={pu.longitude != null ? String(pu.longitude) : ""} /></div>
            </div>
            <div className="space-y-1"><Label htmlFor="address">Address</Label><Input id="address" name="address" defaultValue={(pu.address as string) ?? ""} /></div>
            <div className="space-y-1">
              <Label htmlFor="assigned_agent_id">Assigned agent</Label>
              <NativeSelect id="assigned_agent_id" name="assigned_agent_id" defaultValue={(pu.assigned_agent_id as string) ?? ""}>
                <option value="">Unassigned</option>
                {team.map((t) => (
                  <option key={t.id} value={t.id}>{t.full_name} ({t.role.replace(/_/g, " ")})</option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1"><Label htmlFor="security_notes">Security notes</Label><textarea id="security_notes" name="security_notes" rows={2} className="flex w-full rounded-md border border-input px-3 py-2 text-sm" defaultValue={(pu.security_notes as string) ?? ""} /></div>
            <div className="space-y-1"><Label htmlFor="logistics">Logistics</Label><textarea id="logistics" name="logistics" rows={2} className="flex w-full rounded-md border border-input px-3 py-2 text-sm" defaultValue={(pu.logistics as string) ?? ""} /></div>
            {pu.geocode_status ? <Badge variant="outline">Geocode: {String(pu.geocode_status)}</Badge> : null}
            <SubmitButton label="Save changes" />
          </form>
        </CardContent>
      </Card>

      <form action={deleteAction} className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
        <p className="font-medium">Delete this polling unit?</p>
        <p className="mt-1 text-sm text-muted-foreground">This cannot be undone.</p>
        <Button type="submit" variant="destructive" size="sm" className="mt-3">Delete</Button>
      </form>
    </div>
  );
}
