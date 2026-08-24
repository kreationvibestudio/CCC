"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signUpWithInvite } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BrandLogo } from "@/components/brand/logo";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export function JoinForm({
  token,
  email,
  tenantName,
}: {
  token: string;
  email: string;
  tenantName: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const result = await signUpWithInvite({
      token,
      email,
      password: String(formData.get("password") ?? ""),
      fullName: String(formData.get("fullName") ?? ""),
    });
    setLoading(false);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    if ("requiresEmailConfirmation" in result && result.requiresEmailConfirmation) {
      toast.success("Account created. You can sign in now.");
      router.push("/login");
      return;
    }
    toast.success(`Welcome to ${tenantName}`);
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto mb-3">
          <BrandLogo size={96} className="mx-auto" />
        </div>
        <CardTitle>Join {tenantName}</CardTitle>
        <CardDescription>Create your login for this campaign workspace only.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full name</Label>
            <Input id="fullName" name="fullName" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" value={email} readOnly />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" minLength={8} required />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Join workspace
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
