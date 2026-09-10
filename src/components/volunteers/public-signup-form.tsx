"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registerVolunteerPublic } from "@/lib/volunteers/public";
import { RolePicker } from "@/components/lms/role-picker";

export function PublicVolunteerSignupForm({
  slug,
  campaignName,
}: {
  slug: string;
  campaignName: string;
}) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState<{
    alreadyRegistered: boolean;
    trainingCode?: string;
    slug?: string;
    whatsappSent?: boolean;
    emailSent?: boolean;
  } | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    startTransition(async () => {
      const result = await registerVolunteerPublic(slug, {
        fullName: String(data.get("full_name") ?? ""),
        phone: String(data.get("phone") ?? ""),
        email: String(data.get("email") ?? ""),
        ward: String(data.get("ward") ?? ""),
        lga: String(data.get("lga") ?? ""),
        pollingUnit: String(data.get("polling_unit") ?? ""),
        skills: String(data.get("skills") ?? ""),
        roles: data.getAll("support_roles").map(String),
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setDone({
        alreadyRegistered: Boolean(result.alreadyRegistered),
        trainingCode: result.trainingCode,
        slug: result.slug ?? slug,
        whatsappSent: result.whatsappSent,
        emailSent: result.emailSent,
      });
      form.reset();
    });
  }

  if (done) {
    return (
      <div className="space-y-3 text-center">
        <h2 className="text-xl font-semibold tracking-tight">
          {done.alreadyRegistered ? "You are already on the list" : "Thank you for signing up"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {done.alreadyRegistered
            ? `We updated your details for ${campaignName}. Keep your training code to continue learning.`
            : `Welcome to the ${campaignName} volunteer team. Save your training code — you need it to open Volunteer Training.`}
        </p>
        {done.trainingCode ? (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
            <p className="text-xs text-muted-foreground">Your training code</p>
            <p className="font-mono text-lg font-semibold tracking-wide">{done.trainingCode}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              {done.whatsappSent && done.emailSent
                ? "We also sent this code to your WhatsApp and email."
                : done.whatsappSent
                  ? "We also sent this code to your WhatsApp."
                  : done.emailSent
                    ? "We also sent this code to your email."
                    : "Save this code. You will need it to sign in to training."}
            </p>
            <Button className="mt-3 w-full" asChild>
              <a href={`/learn/${done.slug ?? slug}/login`}>Start training</a>
            </Button>
          </div>
        ) : null}
        <Button type="button" variant="outline" onClick={() => setDone(null)}>
          Register another person
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="full_name">Full name</Label>
        <Input id="full_name" name="full_name" required placeholder="Your full name" autoComplete="name" />
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
        <Label htmlFor="email">Email (optional)</Label>
        <Input id="email" name="email" type="email" placeholder="you@email.com" autoComplete="email" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="lga">LGA</Label>
          <Input id="lga" name="lga" placeholder="Esan North East" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ward">Ward</Label>
          <Input id="ward" name="ward" placeholder="Your ward" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="polling_unit">Polling unit (optional)</Label>
        <Input id="polling_unit" name="polling_unit" placeholder="PU name or code" />
      </div>
            <div className="space-y-1.5">
              <Label htmlFor="skills">Anything else? (optional)</Label>
              <Input
                id="skills"
                name="skills"
                placeholder="driving, photography…"
              />
            </div>
            <RolePicker />
      <Button type="submit" className="w-full" size="lg" disabled={pending}>
        {pending ? "Submitting…" : "Join as a volunteer"}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        By signing up you agree to be contacted by the {campaignName} campaign team.
      </p>
    </form>
  );
}
