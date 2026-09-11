"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { startPublicDonation } from "@/lib/donations/public";

export function PublicDonateForm({
  slug,
  fallbackCheckoutUrl,
}: {
  slug: string;
  fallbackCheckoutUrl: string;
}) {
  const [pending, start] = useTransition();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    start(async () => {
      const result = await startPublicDonation(slug, { fullName, email, phone, amount });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      const url = result.checkoutUrl || fallbackCheckoutUrl;
      window.location.assign(url);
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="donor_name">Full name</Label>
        <Input
          id="donor_name"
          name="full_name"
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Your full name"
          autoComplete="name"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="donor_email">Email</Label>
        <Input
          id="donor_email"
          name="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@email.com"
          autoComplete="email"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="donor_phone">Phone (optional)</Label>
        <Input
          id="donor_phone"
          name="phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="0813 374 7224"
          autoComplete="tel"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="donor_amount">Amount in naira (optional)</Label>
        <Input
          id="donor_amount"
          name="amount"
          inputMode="numeric"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="5000"
        />
      </div>
      <Button type="submit" className="w-full" size="lg" disabled={pending}>
        {pending ? "Opening Paystack…" : "Continue to Paystack"}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        We save you in Campaign CRM as a donor, then Paystack collects the gift.
      </p>
    </form>
  );
}
