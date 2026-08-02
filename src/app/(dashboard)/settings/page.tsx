import { PageHeader } from "@/components/shared/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Profile Settings" description="Manage your account profile" />
      <Card>
        <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">Profile editing coming soon.</CardContent>
      </Card>
    </div>
  );
}
