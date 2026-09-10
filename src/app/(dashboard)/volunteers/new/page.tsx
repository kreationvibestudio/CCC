import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/forms/submit-button";
import { createVolunteer } from "@/lib/volunteers/actions";
import { requireCanCreateOrRedirect } from "@/lib/auth/session";
import { RolePicker } from "@/components/lms/role-picker";

export default async function NewVolunteerPage() {
  await requireCanCreateOrRedirect("/volunteers");
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
            <RolePicker />
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                name="already_trained"
                className="mt-1 h-4 w-4 rounded border-input"
              />
              <span>
                Already completed the campaign briefing
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Leave unchecked for new signups. They start as pending training.
                </span>
              </span>
            </label>
            <SubmitButton label="Add Volunteer" />
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
