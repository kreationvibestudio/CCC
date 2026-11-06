"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MemberGeoCascade } from "@/components/members/member-geo-cascade";
import { registerUnitMemberPublic } from "@/lib/members/public";

export function PublicMemberSignupForm({
  slug,
  campaignName,
}: {
  slug: string;
  campaignName: string;
}) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState<{ alreadyRegistered: boolean } | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    startTransition(async () => {
      const result = await registerUnitMemberPublic(slug, {
        firstName: String(data.get("first_name") ?? ""),
        lastName: String(data.get("last_name") ?? ""),
        phone: String(data.get("phone") ?? ""),
        votersCardNumber: String(data.get("voters_card_number") ?? ""),
        membershipCardNumber: String(data.get("membership_card_number") ?? ""),
        state: String(data.get("state") ?? ""),
        lga: String(data.get("lga") ?? ""),
        ward: String(data.get("ward") ?? ""),
        unitCode: String(data.get("unit_code") ?? ""),
        unitName: String(data.get("unit_name") ?? ""),
        pollingUnitId: String(data.get("polling_unit_id") ?? ""),
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setDone({ alreadyRegistered: Boolean(result.alreadyRegistered) });
      form.reset();
    });
  }

  if (done) {
    return (
      <div className="space-y-3 text-center">
        <h2 className="text-xl font-semibold tracking-tight">
          {done.alreadyRegistered ? "You are already on the register" : "Thank you for registering"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {done.alreadyRegistered
            ? `We updated your NDC unit membership details for ${campaignName}.`
            : `Welcome — your NDC unit membership for ${campaignName} has been recorded.`}
        </p>
        <Button type="button" variant="outline" onClick={() => setDone(null)}>
          Register another member
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="first_name">First name</Label>
          <Input id="first_name" name="first_name" required autoComplete="given-name" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="last_name">Last name</Label>
          <Input id="last_name" name="last_name" required autoComplete="family-name" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="phone">Phone number</Label>
        <Input
          id="phone"
          name="phone"
          required
          type="tel"
          placeholder="0813 374 7224"
          autoComplete="tel"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="voters_card_number">Voter&apos;s card number</Label>
        <Input id="voters_card_number" name="voters_card_number" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="membership_card_number">NDC party card membership number</Label>
        <Input id="membership_card_number" name="membership_card_number" required />
      </div>
      <MemberGeoCascade publicMode />
      <Button type="submit" className="w-full" size="lg" disabled={pending}>
        {pending ? "Submitting…" : "Register as NDC unit member"}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        By registering you agree to be contacted by the {campaignName} campaign team.
      </p>
    </form>
  );
}
