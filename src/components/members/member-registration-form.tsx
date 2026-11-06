"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NdcBadge } from "@/components/brand/ndc-logo";
import { MemberGeoCascade } from "@/components/members/member-geo-cascade";
import {
  createUnitMember,
  getUnitMembersTableMigrationSql,
} from "@/lib/members/actions";

export function MemberRegistrationForm({
  needsMigration = false,
}: {
  needsMigration?: boolean;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement | null>(null);
  const [pending, startTransition] = useTransition();
  const [showSql, setShowSql] = useState(needsMigration);

  async function copySql() {
    const result = await getUnitMembersTableMigrationSql();
    if ("error" in result && result.error) {
      toast.error(result.error);
      return;
    }
    await navigator.clipboard.writeText(result.sql);
    toast.success("Members table SQL copied. Paste in Supabase SQL editor, then Run.");
  }

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createUnitMember({
        firstName: String(formData.get("first_name") ?? ""),
        lastName: String(formData.get("last_name") ?? ""),
        phone: String(formData.get("phone") ?? ""),
        votersCardNumber: String(formData.get("voters_card_number") ?? ""),
        membershipCardNumber: String(formData.get("membership_card_number") ?? ""),
        state: String(formData.get("state") ?? ""),
        lga: String(formData.get("lga") ?? ""),
        ward: String(formData.get("ward") ?? ""),
        unitCode: String(formData.get("unit_code") ?? ""),
        unitName: String(formData.get("unit_name") ?? ""),
        pollingUnitId: String(formData.get("polling_unit_id") ?? ""),
      });
      if (result.needsMigration) setShowSql(true);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("NDC unit member registered");
      formRef.current?.reset();
      if (result.id) router.push(`/members/${result.id}`);
      else router.push("/members");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {showSql ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <p className="font-medium">One SQL apply creates the Members registration table</p>
          <p className="mt-1 text-muted-foreground">
            Cloud Supabase needs the <code>unit_members</code> table before registrations can be stored.
          </p>
          <div className="mt-3">
            <Button type="button" size="sm" onClick={() => void copySql()}>
              Copy Members table SQL
            </Button>
          </div>
        </div>
      ) : null}

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle>Unit member details</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Capture NDC party members by LGA, ward, and polling unit.
            </p>
          </div>
          <NdcBadge />
        </CardHeader>
        <CardContent>
          <form ref={formRef} action={handleSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="first_name">First name</Label>
              <Input id="first_name" name="first_name" required disabled={pending} autoComplete="given-name" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="last_name">Last name</Label>
              <Input id="last_name" name="last_name" required disabled={pending} autoComplete="family-name" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="phone">Phone number</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                required
                disabled={pending}
                placeholder="0813 374 7224"
                autoComplete="tel"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="voters_card_number">Voter&apos;s card number</Label>
              <Input id="voters_card_number" name="voters_card_number" required disabled={pending} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="membership_card_number">NDC party card membership number</Label>
              <Input
                id="membership_card_number"
                name="membership_card_number"
                required
                disabled={pending}
                placeholder="NDC membership number"
              />
            </div>

            <MemberGeoCascade disabled={pending} />

            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Register member"}
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/members">Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
