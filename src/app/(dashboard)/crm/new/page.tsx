import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/forms/submit-button";
import { createContact } from "@/lib/crm/actions";

export default function NewContactPage() {
  async function action(formData: FormData) {
    "use server";
    const result = await createContact(formData);
    if (result.error) throw new Error(result.error);
    redirect("/crm");
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <PageHeader title="New Contact" description="Add a supporter or community leader" />
      <Card>
        <CardContent className="pt-6">
          <form action={action} className="space-y-4">
            <div className="space-y-1"><Label htmlFor="full_name">Full name</Label><Input id="full_name" name="full_name" required /></div>
            <div className="space-y-1">
              <Label htmlFor="contact_type">Contact type</Label>
              <select id="contact_type" name="contact_type" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
                <option value="individual">Individual</option>
                <option value="community_leader">Community leader</option>
                <option value="religious_leader">Religious leader</option>
                <option value="youth_leader">Youth leader</option>
                <option value="women_leader">Women leader</option>
                <option value="donor">Donor</option>
                <option value="influencer">Influencer</option>
              </select>
            </div>
            <div className="space-y-1"><Label htmlFor="phone">Phone</Label><Input id="phone" name="phone" /></div>
            <div className="space-y-1"><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1"><Label htmlFor="ward">Ward</Label><Input id="ward" name="ward" /></div>
              <div className="space-y-1"><Label htmlFor="lga">LGA</Label><Input id="lga" name="lga" /></div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="support_level">Support level</Label>
              <select id="support_level" name="support_level" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
                <option value="strong">Strong supporter</option>
                <option value="leaning">Leaning</option>
                <option value="undecided">Undecided</option>
                <option value="opposed">Opposed</option>
              </select>
            </div>
            <SubmitButton label="Add Contact" />
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
