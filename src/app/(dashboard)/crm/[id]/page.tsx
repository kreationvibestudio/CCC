import { redirect } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/forms/submit-button";
import { getContact, getContactInteractions, getContactDonations, updateContact, deleteContact, logInteraction, recordDonation } from "@/lib/crm/actions";

export default async function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const contact = await getContact(id);
  if (!contact) redirect("/crm");
  const [interactions, donations] = await Promise.all([getContactInteractions(id), getContactDonations(id)]);

  async function saveAction(formData: FormData) {
    "use server";
    const r = await updateContact(id, formData);
    if (r.error) throw new Error(r.error);
    redirect(`/crm/${id}`);
  }

  async function deleteAction() {
    "use server";
    await deleteContact(id);
    redirect("/crm");
  }

  async function interactionAction(formData: FormData) {
    "use server";
    await logInteraction(id, formData);
    redirect(`/crm/${id}`);
  }

  async function donationAction(formData: FormData) {
    "use server";
    await recordDonation(id, formData);
    redirect(`/crm/${id}`);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title={contact.full_name} description={contact.contact_type.replace(/_/g, " ")}>
        <Badge>{contact.support_level}</Badge>
        <Button variant="outline" asChild><Link href="/crm">Back</Link></Button>
      </PageHeader>
      <Card><CardContent className="pt-6">
        <form action={saveAction} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1"><Label>Name</Label><Input name="full_name" defaultValue={contact.full_name} required /></div>
            <div className="space-y-1"><Label>Phone</Label><Input name="phone" defaultValue={contact.phone ?? ""} /></div>
            <div className="space-y-1"><Label>Ward</Label><Input name="ward" defaultValue={contact.ward ?? ""} /></div>
            <div className="space-y-1"><Label>LGA</Label><Input name="lga" defaultValue={contact.lga ?? ""} /></div>
          </div>
          <input type="hidden" name="contact_type" value={contact.contact_type} />
          <input type="hidden" name="support_level" value={contact.support_level} />
          <textarea name="notes" rows={2} className="flex w-full rounded-md border border-input px-3 py-2 text-sm" defaultValue={contact.notes ?? ""} placeholder="Notes" />
          <SubmitButton label="Save" />
        </form>
      </CardContent></Card>
      <Card><CardContent className="pt-6">
        <h2 className="mb-2 font-semibold">Interactions</h2>
        {interactions.map((i) => (
          <p key={i.id} className="mb-1 text-sm text-muted-foreground">{i.interaction_type}: {i.notes}</p>
        ))}
        <form action={interactionAction} className="mt-3 space-y-2">
          <select name="interaction_type" className="flex h-9 w-full rounded-md border border-input px-3 text-sm">
            <option value="call">Call</option>
            <option value="meeting">Meeting</option>
            <option value="visit">Visit</option>
          </select>
          <Input name="notes" placeholder="Notes" required />
          <Button type="submit" size="sm">Log interaction</Button>
        </form>
      </CardContent></Card>
      <Card><CardContent className="pt-6">
        <h2 className="mb-2 font-semibold">Donations (₦{Number(contact.total_donations).toLocaleString()})</h2>
        {donations.map((d) => (
          <p key={d.id} className="text-sm">
            ₦{Number(d.amount).toLocaleString()} — {d.payment_method}
            {d.payment_reference ? ` · ${d.payment_reference}` : ""}
          </p>
        ))}
        <form action={donationAction} className="mt-3 flex gap-2">
          <Input name="amount" type="number" placeholder="Amount" required />
          <Input name="payment_method" placeholder="Method" defaultValue="bank_transfer" />
          <Button type="submit" size="sm">Record</Button>
        </form>
      </CardContent></Card>
      <form action={deleteAction}><Button type="submit" variant="destructive" size="sm">Delete contact</Button></form>
    </div>
  );
}
