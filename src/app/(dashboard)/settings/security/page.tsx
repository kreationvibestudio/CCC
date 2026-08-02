import { PageHeader } from "@/components/shared/page-shell";
import { SecuritySettings } from "@/components/settings/security-settings";

export default function SecurityPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Security" description="Two-factor authentication and account security" />
      <SecuritySettings />
    </div>
  );
}
