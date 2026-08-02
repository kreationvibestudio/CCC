import { redirect } from "next/navigation";
import { getEventPublic, checkInAttendee } from "@/lib/events/actions";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/forms/submit-button";

export default async function EventCheckInPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ code?: string }>;
}) {
  const { id } = await params;
  const { code } = await searchParams;
  const event = await getEventPublic(id);
  if (!event) redirect("/events");
  if (code && event.qr_code && code !== event.qr_code) {
    return <div className="p-8 text-center">Invalid check-in code</div>;
  }

  async function action(formData: FormData) {
    "use server";
    const r = await checkInAttendee(id, formData);
    if (r.error) throw new Error(r.error);
    redirect(`/events/${id}/checkin?success=1`);
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md items-center p-4">
      <Card className="w-full">
        <CardContent className="space-y-4 pt-6">
          <h1 className="text-xl font-bold">{event.title}</h1>
          <p className="text-sm text-muted-foreground">{event.location}</p>
          <form action={action} className="space-y-3">
            <Input name="name" placeholder="Your full name" required />
            <Input name="phone" placeholder="Phone number" required />
            <SubmitButton label="Check in" />
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
