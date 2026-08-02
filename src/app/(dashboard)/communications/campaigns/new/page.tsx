import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/forms/submit-button";
import { createCampaign } from "@/lib/communications/actions";

export default function NewCampaignPage() {
  async function action(formData: FormData) {
    "use server";
    const result = await createCampaign(formData);
    if (result.error) throw new Error(result.error);
    redirect("/communications");
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <PageHeader title="New SMS Campaign" description="Create a draft Termii campaign" />
      <Card><CardContent className="pt-6">
        <form action={action} className="space-y-4">
          <div className="space-y-1"><Label>Campaign name</Label><Input name="name" required /></div>
          <input type="hidden" name="channel" value="sms" />
          <SubmitButton label="Create campaign" />
        </form>
        <p className="mt-4 text-xs text-muted-foreground">After creating, use the send API or admin tools to dispatch via Termii.</p>
      </CardContent></Card>
    </div>
  );
}
