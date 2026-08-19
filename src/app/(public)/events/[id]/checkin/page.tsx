import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/forms/submit-button";
import { checkInAttendee, getEventPublic } from "@/lib/events/actions";

export default async function EventCheckInPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ code?: string; success?: string }>;
}) {
  const { id } = await params;
  const { code, success } = await searchParams;
  const event = await getEventPublic(id);

  if (!event) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md items-center p-4">
        <Card className="w-full">
          <CardContent className="pt-6 text-center text-sm text-muted-foreground">
            This check-in link is invalid or the event was removed.
          </CardContent>
        </Card>
      </div>
    );
  }

  if (code && event.qr_code && code !== event.qr_code) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md items-center p-4">
        <p className="w-full text-center">Invalid check-in code</p>
      </div>
    );
  }

  async function action(formData: FormData) {
    "use server";
    const r = await checkInAttendee(id, formData);
    if (r.error) throw new Error(r.error);
    redirect(`/events/${id}/checkin?success=1`);
  }

  if (success) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md items-center p-4">
        <Card className="w-full">
          <CardContent className="space-y-2 pt-6 text-center">
            <h1 className="text-xl font-bold">You are checked in</h1>
            <p className="text-sm text-muted-foreground">{event.title}</p>
          </CardContent>
        </Card>
      </div>
    );
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
