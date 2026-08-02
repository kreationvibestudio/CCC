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
      <PageHeader title="Add Polling Unit" description="Register a new polling unit in Edo/Esan" />
      <Card>
        <CardContent className="pt-6">
          <form action={action} className="space-y-4">
            <div className="space-y-1"><Label htmlFor="code">PU Code</Label><Input id="code" name="code" placeholder="ED/ESN/01/001" required /></div>
            <div className="space-y-1"><Label htmlFor="name">Name</Label><Input id="name" name="name" required /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1"><Label htmlFor="ward">Ward</Label><Input id="ward" name="ward" /></div>
              <div className="space-y-1"><Label htmlFor="lga">LGA</Label><Input id="lga" name="lga" placeholder="Esan North-East" /></div>
            </div>
            <input type="hidden" name="state" value="Edo" />
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
