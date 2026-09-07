import { redirect } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import QRCode from "qrcode";
import { PageHeader } from "@/components/shared/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/forms/submit-button";
import { getEvent, getEventAttendees, updateEvent, deleteEvent } from "@/lib/events/actions";
import { getCurrentUser } from "@/lib/auth/session";
import { canDeleteRecords, canWriteRecords } from "@/types/auth";

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const canWrite = user ? canWriteRecords(user.role) : false;
  const canDelete = user ? canDeleteRecords(user.role) : false;
  const event = await getEvent(id);
  if (!event) redirect("/events");
  const attendees = await getEventAttendees(id);
  const qrDataUrl = event.qr_code
    ? await QRCode.toDataURL(`${process.env.NEXT_PUBLIC_APP_URL ?? ""}/events/${id}/checkin?code=${event.qr_code}`, { width: 200 })
    : null;

  async function saveAction(formData: FormData) {
    "use server";
    const r = await updateEvent(id, formData);
    if (r.error) throw new Error(r.error);
    redirect(`/events/${id}`);
  }

  async function deleteAction() {
    "use server";
    await deleteEvent(id);
    redirect("/events");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title={event.title} description={format(new Date(event.starts_at), "PPp")}>
        <Button variant="outline" asChild><Link href="/events">Back</Link></Button>
      </PageHeader>
      {qrDataUrl && (
        <Card><CardContent className="flex flex-col items-center pt-6">
          <img src={qrDataUrl} alt="Check-in QR" width={200} height={200} />
          <p className="mt-2 text-xs text-muted-foreground">Code: {event.qr_code}</p>
          <Button variant="link" asChild><Link href={`/events/${id}/checkin`}>Open check-in page</Link></Button>
        </CardContent></Card>
      )}
      <Card><CardContent className="pt-6">
        <form action={saveAction} className="space-y-4">
          <div className="space-y-1"><Label>Title</Label><Input name="title" defaultValue={event.title} required disabled={!canWrite} /></div>
          <div className="space-y-1"><Label>Location</Label><Input name="location" defaultValue={event.location} required disabled={!canWrite} /></div>
          <input type="hidden" name="event_type" value={event.event_type} />
          <input type="hidden" name="starts_at" value={event.starts_at} />
          <textarea name="description" rows={2} className="flex w-full rounded-md border border-input px-3 py-2 text-sm" defaultValue={event.description ?? ""} disabled={!canWrite} />
          {canWrite ? <SubmitButton label="Save" /> : null}
        </form>
      </CardContent></Card>
      <Card><CardContent className="pt-6">
        <h2 className="font-semibold">Attendees ({attendees.length})</h2>
        {attendees.map((a) => (
          <div key={a.id} className="flex justify-between border-b py-2 text-sm">
            <span>{a.name}</span>
            <Badge variant="secondary">{a.rsvp_status}</Badge>
          </div>
        ))}
      </CardContent></Card>
      {canDelete ? (
      <form action={deleteAction}><Button type="submit" variant="destructive" size="sm">Cancel event</Button></form>
      ) : null}
    </div>
  );
}
