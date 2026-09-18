"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { changeOwnPassword, signOut } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BrandLogo } from "@/components/brand/logo";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { recoverStaleServerAction } from "@/lib/stale-server-action";

export function ChangePasswordForm({
  mode = "first-login",
}: {
  mode?: "first-login" | "settings";
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const firstLogin = mode === "first-login";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const current = (form.elements.namedItem("current") as HTMLInputElement).value;
    const next = (form.elements.namedItem("password") as HTMLInputElement).value;
    const confirm = (form.elements.namedItem("confirm") as HTMLInputElement).value;
    setLoading(true);
    try {
      const result = await changeOwnPassword({ current, next, confirm });
      setLoading(false);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(
        firstLogin
          ? "Password saved. Opening your campaign briefing…"
          : "Password updated."
      );
      form.reset();
      if (firstLogin) {
        router.push(result.next || "/dashboard");
        router.refresh();
      }
    } catch (error) {
      setLoading(false);
      if (recoverStaleServerAction(error)) return;
      toast.error(error instanceof Error ? error.message : "Could not change password.");
    }
  }

  const fields = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="current">{firstLogin ? "Temporary password" : "Current password"}</Label>
        <Input
          id="current"
          name="current"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">New password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          minLength={8}
          autoComplete="new-password"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm">Confirm new password</Label>
        <Input
          id="confirm"
          name="confirm"
          type="password"
          minLength={8}
          autoComplete="new-password"
          required
        />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Save new password
      </Button>
    </form>
  );

  if (!firstLogin) {
    return fields;
  }

  return (
    <Card className="w-full border-border/50 war-room-glow">
      <CardHeader className="text-center">
        <div className="mx-auto mb-3">
          <BrandLogo size={96} className="mx-auto" />
        </div>
        <CardTitle className="text-2xl">Set your permanent password</CardTitle>
        <CardDescription>
          HQ sent you a temporary password. Replace it before using Campaign Command Center.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {fields}
        <div className="mt-4 text-center text-sm text-muted-foreground">
          <button type="button" className="hover:text-primary" onClick={() => signOut()}>
            Sign out
          </button>
          {" · "}
          <Link href="/forgot-password" className="hover:text-primary">
            Forgot password?
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
