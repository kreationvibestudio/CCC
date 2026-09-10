"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { signIn } from "@/lib/auth/actions";
import { readLoginCredentials } from "@/lib/auth/login-credentials";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BrandLogo } from "@/components/brand/logo";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { safeInternalPath } from "@/lib/auth/bearer";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const credentials = readLoginCredentials(new FormData(e.currentTarget));
    if ("error" in credentials) {
      toast.error(credentials.error);
      return;
    }
    setLoading(true);
    const result = await signIn(credentials.email, credentials.password);
    setLoading(false);

    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success("Welcome to Campaign Command Center");
    const next =
      safeInternalPath(searchParams.get("redirect")) || result.next || "/dashboard";
    router.push(next);
    router.refresh();
  }

  return (
    <Card className="w-full max-w-md border-border/50 war-room-glow">
      <CardHeader className="text-center">
        <div className="mx-auto mb-3">
          <BrandLogo size={128} priority className="mx-auto" />
        </div>
        <CardTitle className="sr-only">Campaign Command Center</CardTitle>
        <CardDescription>Sign in to your campaign war room</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              placeholder="you@campaign.ng"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Sign In
          </Button>
        </form>
        <div className="mt-4 text-center text-sm text-muted-foreground">
          <Link href="/forgot-password" className="hover:text-primary">Forgot password?</Link>
          {" · "}
          <Link href="/register" className="hover:text-primary">Create account</Link>
        </div>
      </CardContent>
    </Card>
  );
}
