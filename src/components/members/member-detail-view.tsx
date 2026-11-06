"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NdcBadge } from "@/components/brand/ndc-logo";
import { usePermissions } from "@/components/providers/auth-provider";
import { deleteUnitMember, type MemberListItem } from "@/lib/members/actions";
import { formatDate } from "@/lib/utils";

export function MemberDetailView({ member }: { member: MemberListItem }) {
  const router = useRouter();
  const { can, canDelete } = usePermissions();
  const canRemove = canDelete && can("members.manage");
  const [pending, startTransition] = useTransition();

  function onDelete() {
    if (!confirm(`Remove ${member.full_name} from the members register?`)) return;
    startTransition(async () => {
      const result = await deleteUnitMember(member.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Member removed");
      router.push("/members");
      router.refresh();
    });
  }

  const rows = [
    ["First name", member.first_name],
    ["Last name", member.last_name],
    ["Phone", member.phone],
    ["Voter's card number", member.voters_card_number],
    ["NDC party card number", member.membership_card_number],
    ["State", member.state || "—"],
    ["LGA", member.lga],
    ["Ward", member.ward],
    ["Unit", member.unit_code || "—"],
    ["Unit name", member.unit_name || "—"],
    ["Registered", formatDate(member.created_at)],
  ] as const;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <PageHeader title={member.full_name} description="NDC unit member record">
        <NdcBadge className="mr-2" />
        <Button variant="outline" asChild>
          <Link href="/members">Back</Link>
        </Button>
        {canRemove ? (
          <Button variant="destructive" disabled={pending} onClick={onDelete}>
            {pending ? "Removing…" : "Remove"}
          </Button>
        ) : null}
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle>Member details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {rows.map(([label, value]) => (
            <div key={label} className="space-y-1">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-sm font-medium break-all">{value}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
