"use client";

import { useState } from "react";
import Link from "next/link";
import { resetPassword } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BrandLogo } from "@/components/brand/logo";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export function ForgotPasswordForm() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const email = new FormData(e.currentTarget).get("email") as string;
    const result = await resetPassword(email);
    setLoading(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }
    setSent(true);
    toast.success("Password reset link sent");
  }

  return (
    <Card className="w-full border-border/50 war-room-glow">
      <CardHeader className="text-center">
        <div className="mx-auto mb-3">
          <BrandLogo size={96} className="mx-auto" />
        </div>
        <CardTitle className="text-2xl">Reset Password</CardTitle>
        <CardDescription>
          {sent ? "Check your email for a reset link." : "Enter your email to receive a reset link"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!sent && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send Reset Link
            </Button>
          </form>
        )}
        <div className="mt-4 text-center text-sm text-muted-foreground">
          <Link href="/login" className="hover:text-primary">Back to sign in</Link>
        </div>
      </CardContent>
    </Card>
  );
}
