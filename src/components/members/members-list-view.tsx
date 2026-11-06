"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { PageHeader, EmptyState } from "@/components/shared/page-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NdcBadge } from "@/components/brand/ndc-logo";
import { usePermissions } from "@/components/providers/auth-provider";
import { formatDate } from "@/lib/utils";
import {
  getUnitMembersTableMigrationSql,
  type MemberListItem,
} from "@/lib/members/actions";
import { IdCard, Plus } from "lucide-react";

export function MembersListView({
  members,
  needsMigration = false,
}: {
  members: MemberListItem[];
  needsMigration?: boolean;
}) {
  const { can, canCreate } = usePermissions();
  const canRegister = canCreate && can("members.manage");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) =>
      [
        m.full_name,
        m.phone,
        m.lga,
        m.ward,
        m.unit_code,
        m.membership_card_number,
        m.voters_card_number,
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [members, search]);

  async function copySql() {
    const result = await getUnitMembersTableMigrationSql();
    if ("error" in result && result.error) {
      toast.error(result.error);
      return;
    }
    await navigator.clipboard.writeText(result.sql);
    toast.success("Members table SQL copied. Paste in Supabase SQL editor, then Run.");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Members"
        description="NDC unit members registered by LGA, ward, and polling unit"
      >
        <NdcBadge className="mr-2 hidden sm:inline-flex" />
        {canRegister ? (
          <Button asChild>
            <Link href="/members/new">
              <Plus className="mr-2 h-4 w-4" />
              Register member
            </Link>
          </Button>
        ) : null}
      </PageHeader>

      {needsMigration ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <p className="font-medium">One SQL apply creates the Members registration table</p>
          <p className="mt-1 text-muted-foreground">
            Run this once in Supabase so unit member registrations can be stored.
          </p>
          <div className="mt-3">
            <Button type="button" size="sm" onClick={() => void copySql()}>
              Copy Members table SQL
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, phone, LGA, ward, NDC card…"
          className="max-w-sm"
        />
        <Badge variant="secondary">{filtered.length} shown</Badge>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={members.length === 0 ? "No members registered yet" : "No members match"}
          description={
            members.length === 0
              ? "Register NDC unit members with first name, last name, phone, voter's card, party card, LGA, ward, and unit."
              : "Try a different search."
          }
          action={
            canRegister && members.length === 0 ? (
              <Button asChild>
                <Link href="/members/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Register member
                </Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-3">
          {filtered.map((member) => (
            <Card key={member.id} className="overflow-hidden">
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <IdCard className="h-4 w-4 text-emerald-600" />
                    <Link
                      href={`/members/${member.id}`}
                      className="truncate font-medium hover:underline"
                    >
                      {member.full_name}
                    </Link>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {member.phone}
                    {member.unit_code ? ` · ${member.unit_code}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {member.lga} · {member.ward}
                    {member.unit_name ? ` · ${member.unit_name}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    NDC card {member.membership_card_number} · PVC {member.voters_card_number}
                  </p>
                </div>
                <div className="shrink-0 text-xs text-muted-foreground">
                  {formatDate(member.created_at)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
