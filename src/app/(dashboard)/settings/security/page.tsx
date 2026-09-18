import { PageHeader } from "@/components/shared/page-shell";
import { SecuritySettings } from "@/components/settings/security-settings";
import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SecurityPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Security" description="Password, two-factor authentication, and account security" />
      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
          <CardDescription>Enter your current password, then choose a new one.</CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm mode="settings" />
        </CardContent>
      </Card>
      <SecuritySettings />
    </div>
  );
}
