import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { SubmitButton } from "@/components/forms/submit-button";
import { createEvent } from "@/lib/events/actions";

export default function NewEventPage() {
  async function action(formData: FormData) {
    "use server";
    const result = await createEvent(formData);
    if (result.error) throw new Error(result.error);
    redirect("/events");
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <PageHeader title="New Event" description="Schedule a campaign event with QR check-in" />
      <Card>
        <CardContent className="pt-6">
          <form action={action} className="space-y-4">
            <div className="space-y-1"><Label htmlFor="title">Title</Label><Input id="title" name="title" required /></div>
            <div className="space-y-1">
              <Label htmlFor="event_type">Event type</Label>
              <NativeSelect id="event_type" name="event_type">
                <option value="town_hall">Town hall</option>
                <option value="rally">Rally</option>
                <option value="ward_meeting">Ward meeting</option>
                <option value="door_to_door">Door to door</option>
                <option value="fundraising_dinner">Fundraising dinner</option>
                <option value="press_conference">Press conference</option>
              </NativeSelect>
            </div>
            <div className="space-y-1"><Label htmlFor="location">Location</Label><Input id="location" name="location" required /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1"><Label htmlFor="ward">Ward</Label><Input id="ward" name="ward" /></div>
              <div className="space-y-1"><Label htmlFor="lga">LGA</Label><Input id="lga" name="lga" /></div>
            </div>
            <div className="space-y-1"><Label htmlFor="starts_at">Starts at</Label><Input id="starts_at" name="starts_at" type="datetime-local" required /></div>
            <div className="space-y-1"><Label htmlFor="ends_at">Ends at</Label><Input id="ends_at" name="ends_at" type="datetime-local" /></div>
            <div className="space-y-1"><Label htmlFor="max_attendees">Max attendees</Label><Input id="max_attendees" name="max_attendees" type="number" min={1} /></div>
            <div className="space-y-1"><Label htmlFor="description">Description</Label><textarea id="description" name="description" rows={3} className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" /></div>
            <SubmitButton label="Create Event" />
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
