"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function LoginForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const result = await signIn(
      formData.get("email") as string,
      formData.get("password") as string
    );
    setLoading(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Welcome to Campaign Command Center");
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <Card className="w-full max-w-md border-border/50 war-room-glow">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
          <Shield className="h-6 w-6 text-primary" />
        </div>
        <CardTitle className="text-2xl">Campaign Command Center</CardTitle>
        <CardDescription>Sign in to your campaign war room</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" placeholder="admin@demo.campaign.ng" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" placeholder="••••••••" required />
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
