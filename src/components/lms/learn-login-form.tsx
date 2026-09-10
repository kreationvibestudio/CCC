"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginVolunteerLearn } from "@/lib/lms/learn";

export function LearnLoginForm({ slug, campaignName }: { slug: string; campaignName: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    start(async () => {
      const result = await loginVolunteerLearn({
        slug,
        phone: String(data.get("phone") ?? ""),
        code: String(data.get("code") ?? ""),
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      router.push(`/learn/${slug}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Sign in to {campaignName} volunteer training with the phone number you registered and your training code.
      </p>
      <div className="space-y-1.5">
        <Label htmlFor="phone">Phone number</Label>
        <Input id="phone" name="phone" type="tel" required autoComplete="tel" placeholder="0813 374 7224" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="code">Training code</Label>
        <Input id="code" name="code" required autoComplete="one-time-code" placeholder="XXXX-XXXX" className="font-mono uppercase" />
      </div>
      <Button type="submit" className="w-full" size="lg" disabled={pending}>
        {pending ? "Signing in…" : "Open my training"}
      </Button>
    </form>
  );
}
