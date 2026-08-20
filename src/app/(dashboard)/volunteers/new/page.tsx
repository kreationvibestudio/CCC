import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { SubmitButton } from "@/components/forms/submit-button";
import { createVolunteer } from "@/lib/volunteers/actions";

export default function NewVolunteerPage() {
  async function action(formData: FormData) {
    "use server";
    const result = await createVolunteer(formData);
    if (result.error) throw new Error(result.error);
    redirect("/volunteers");
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <PageHeader title="New Volunteer" description="Add a field volunteer to your team" />
      <Card>
        <CardContent className="pt-6">
          <form action={action} className="space-y-4">
            <div className="space-y-1"><Label htmlFor="full_name">Full name</Label><Input id="full_name" name="full_name" required /></div>
            <div className="space-y-1"><Label htmlFor="phone">Phone</Label><Input id="phone" name="phone" required /></div>
            <div className="space-y-1"><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1"><Label htmlFor="ward">Ward</Label><Input id="ward" name="ward" /></div>
              <div className="space-y-1"><Label htmlFor="lga">LGA</Label><Input id="lga" name="lga" /></div>
            </div>
            <div className="space-y-1"><Label htmlFor="polling_unit">Polling unit</Label><Input id="polling_unit" name="polling_unit" /></div>
            <div className="space-y-1"><Label htmlFor="skills">Skills (comma-separated)</Label><Input id="skills" name="skills" placeholder="canvassing, driving, media" /></div>
            <div className="space-y-1">
              <Label htmlFor="training_status">Training status</Label>
              <NativeSelect id="training_status" name="training_status">
                <option value="pending">Pending</option>
                <option value="in_progress">In progress</option>
                <option value="completed">Completed</option>
              </NativeSelect>
            </div>
            <SubmitButton label="Add Volunteer" />
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
