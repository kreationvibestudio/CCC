import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { updateOwnProfile } from "@/lib/settings/actions";
import { PageHeader } from "@/components/shared/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/forms/submit-button";
import { Badge } from "@/components/ui/badge";
import { redirect } from "next/navigation";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  async function action(formData: FormData) {
    "use server";
    const result = await updateOwnProfile(formData);
    if (result.error) throw new Error(result.error);
    redirect("/settings?saved=1");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profile Settings"
        description="Update your campaign profile details"
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            Profile
            <Badge variant="secondary">{user.role.replace(/_/g, " ")}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form action={action} className="mx-auto max-w-lg space-y-4">
            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={user.email} disabled readOnly />
              <p className="text-xs text-muted-foreground">Email is managed by auth and cannot be edited here.</p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="full_name">Full name</Label>
              <Input
                id="full_name"
                name="full_name"
                defaultValue={user.profile.full_name}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                name="phone"
                defaultValue={user.profile.phone ?? ""}
                placeholder="+234…"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="ward">Ward</Label>
                <Input
                  id="ward"
                  name="ward"
                  defaultValue={user.profile.ward ?? ""}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="lga">LGA</Label>
                <Input
                  id="lga"
                  name="lga"
                  defaultValue={user.profile.lga ?? ""}
                />
              </div>
            </div>
            <SubmitButton label="Save profile" />
          </form>
          <p className="mt-4 text-sm text-muted-foreground">
            For MFA, open{" "}
            <Link href="/settings/security" className="text-primary underline-offset-2 hover:underline">
              Security settings
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
