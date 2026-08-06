import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/forms/submit-button";
import { createTemplate } from "@/lib/communications/actions";

export default function NewSmsTemplatePage() {
  async function action(formData: FormData) {
    "use server";
    const result = await createTemplate(formData);
    if (result.error) throw new Error(result.error);
    redirect("/communications");
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <PageHeader
        title="New SMS Template"
        description="Reusable Termii SMS body. Use {{name}} for the contact’s first name."
      />
      <Card>
        <CardContent className="pt-6">
          <form action={action} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="name">Template name</Label>
              <Input id="name" name="name" required />
            </div>
            <input type="hidden" name="channel" value="sms" />
            <div className="space-y-1">
              <Label htmlFor="body">Message body</Label>
              <textarea
                id="body"
                name="body"
                required
                rows={5}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                placeholder="Hello {{name}}, …"
              />
            </div>
            <SubmitButton label="Save SMS template" />
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
