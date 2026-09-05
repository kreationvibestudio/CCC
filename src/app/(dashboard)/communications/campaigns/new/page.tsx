import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { SubmitButton } from "@/components/forms/submit-button";
import { createCampaign, getTemplates } from "@/lib/communications/actions";

export default async function NewCampaignPage() {
  const templates = (await getTemplates()).filter(
    (t: { channel: string }) => t.channel === "sms"
  );

  async function action(formData: FormData) {
    "use server";
    const result = await createCampaign(formData);
    if (result.error) throw new Error(result.error);
    redirect("/communications");
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <PageHeader
        title="New SMS Campaign"
        description="Create a draft Termii campaign, then send it from Communications"
      />
      <Card>
        <CardContent className="pt-6">
          <form action={action} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="name">Campaign name</Label>
              <Input id="name" name="name" required />
            </div>
            <input type="hidden" name="channel" value="sms" />
            <div className="space-y-1">
              <Label htmlFor="template_id">Default SMS template (optional)</Label>
              <NativeSelect
                id="template_id"
                name="template_id"
                defaultValue=""
              >
                <option value="">Choose when sending</option>
                {templates.map((t: { id: string; name: string }) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <SubmitButton label="Create campaign" />
          </form>
          <p className="mt-4 text-xs text-muted-foreground">
            After creating, open the campaign’s Send button on the Communications page to
            dispatch via Termii.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
