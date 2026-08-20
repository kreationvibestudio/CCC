import { createServiceClient } from "@/lib/supabase/admin";
import { getInviteByToken } from "@/lib/invites";
import { JoinForm } from "@/components/auth/join-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let invite = null;
  try {
    const admin = createServiceClient();
    invite = await getInviteByToken(admin, token);
  } catch {
    invite = null;
  }

  if (!invite) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Invitation unavailable</CardTitle>
          <CardDescription>This link is invalid or has already been used.</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/login" className="text-sm text-primary hover:underline">
            Sign in
          </Link>
        </CardContent>
      </Card>
    );
  }

  return <JoinForm token={token} email={invite.email} tenantName={invite.tenantName} />;
}
