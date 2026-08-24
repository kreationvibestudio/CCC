import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/forms/submit-button";
import { createPollingUnit } from "@/lib/polling-units/actions";

export default function NewPollingUnitPage() {
  async function action(formData: FormData) {
    "use server";
    const result = await createPollingUnit(formData);
    if (result.error) throw new Error(result.error);
    redirect("/polling-units");
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <PageHeader title="Add Polling Unit" description="Register a polling unit using INEC fields" />
      <Card>
        <CardContent className="pt-6">
          <form action={action} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="code">PU Code</Label>
              <Input id="code" name="code" placeholder="FCT/AMAC/01/001" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="name">Location</Label>
              <Input id="name" name="name" placeholder="School or venue name" required />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1"><Label htmlFor="state_code">State code</Label><Input id="state_code" name="state_code" placeholder="12" /></div>
              <div className="space-y-1"><Label htmlFor="lg_code">LGA code</Label><Input id="lg_code" name="lg_code" placeholder="04" /></div>
              <div className="space-y-1"><Label htmlFor="ward_code">Ward code</Label><Input id="ward_code" name="ward_code" placeholder="01" /></div>
              <div className="space-y-1"><Label htmlFor="pu_code">PU code</Label><Input id="pu_code" name="pu_code" placeholder="001" /></div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1"><Label htmlFor="ward">Ward (ward_des)</Label><Input id="ward" name="ward" placeholder="Uromi I" /></div>
              <div className="space-y-1"><Label htmlFor="lga">LGA (lg_des)</Label><Input id="lga" name="lga" placeholder="Esan North-East" /></div>
            </div>
            <div className="space-y-1"><Label htmlFor="state">State</Label><Input id="state" name="state" defaultValue="Edo" /></div>
            <div className="space-y-1"><Label htmlFor="registered_voters">Registered voters</Label><Input id="registered_voters" name="registered_voters" type="number" /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1"><Label htmlFor="latitude">Latitude</Label><Input id="latitude" name="latitude" type="number" step="any" /></div>
              <div className="space-y-1"><Label htmlFor="longitude">Longitude</Label><Input id="longitude" name="longitude" type="number" step="any" /></div>
            </div>
            <SubmitButton label="Add polling unit" />
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
