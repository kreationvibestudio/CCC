import Link from "next/link";
import { RegisterForm } from "@/components/auth/register-form";
import { isRegistrationOpen } from "@/lib/auth/actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BrandLogo } from "@/components/brand/logo";

export default async function RegisterPage() {
  if (await isRegistrationOpen()) return <RegisterForm />;

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto mb-3">
          <BrandLogo size={96} className="mx-auto" />
        </div>
        <CardTitle>Invitation required</CardTitle>
        <CardDescription>
          This campaign workspace does not accept public sign-ups. An administrator can send
          you an invite link that creates your account with the right role.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-center text-sm text-muted-foreground">
        <p>
          Already have an account?{" "}
          <Link href="/login" className="text-primary hover:underline">Sign in</Link>
        </p>
        <p>
          Field agents can sign in with an access code at{" "}
          <Link href="/agent/login" className="text-primary hover:underline">/agent/login</Link>.
        </p>
      </CardContent>
    </Card>
  );
}
