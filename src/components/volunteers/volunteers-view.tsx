"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Users, Plus, Copy, ExternalLink } from "lucide-react";
import { PageHeader, EmptyState, StatCard } from "@/components/shared/page-shell";
import { CampaignWebsite } from "@/components/shared/campaign-website";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { Volunteer } from "@/types/database";
import { usePermissions } from "@/components/providers/auth-provider";
import { TrainingBadge } from "@/components/volunteers/training-badge";
import { getVolunteerTrainingSql } from "@/lib/volunteers/actions";
import {
  countTraining,
  filterByTraining,
  type TrainingListFilter,
} from "@/lib/volunteers/training";

export function VolunteersView({
  volunteers,
  signupUrl = "",
}: {
  volunteers: Volunteer[];
  signupUrl?: string;
}) {
  const router = useRouter();
  const { canCreate } = usePermissions();
  const [filter, setFilter] = useState<TrainingListFilter>("all");
  const counts = countTraining(volunteers);
  const rows = useMemo(() => filterByTraining(volunteers, filter), [volunteers, filter]);

  function copySignupLink() {
    if (!signupUrl) {
      toast.error("Set NEXT_PUBLIC_APP_URL to share the public signup link");
      return;
    }
    void navigator.clipboard.writeText(signupUrl);
    toast.success("Volunteer signup link copied");
  }

  async function copyTrainingSql() {
    const result = await getVolunteerTrainingSql();
    if (result.error) {
      toast.error(result.error);
      return;
    }
    await navigator.clipboard.writeText(result.sql);
    toast.success("SQL copied. Paste it in the Supabase SQL editor if Mark trained fails.");
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Volunteers" description="Manage field volunteers and coordinators">
        {canCreate ? (
        <Button asChild>
          <Link href="/volunteers/new">
            <Plus className="mr-2 h-4 w-4" />
            Add Volunteer
          </Link>
        </Button>
        ) : null}
      </PageHeader>

      {signupUrl ? (
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-sm font-medium">Public signup link</p>
              <p className="text-xs text-muted-foreground">
                Put this on <CampaignWebsite /> as a Volunteer button so people can register
                themselves.
              </p>
              <Input readOnly value={signupUrl} className="mt-1 font-mono text-xs" />
            </div>
            <div className="flex shrink-0 gap-2">
              <Button type="button" variant="secondary" onClick={copySignupLink}>
                <Copy className="mr-2 h-4 w-4" />
                Copy
              </Button>
              <Button type="button" variant="outline" asChild>
                <a href={signupUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          title="Total Volunteers"
          value={counts.total}
          icon={Users}
          onClick={() => setFilter("all")}
          active={filter === "all"}
        />
        <StatCard
          title="Trained"
          value={counts.trained}
          change="Completed campaign briefing"
          onClick={() => setFilter("trained")}
          active={filter === "trained"}
        />
        <StatCard
          title="Pending Training"
          value={counts.pending}
          change="Includes in progress"
          onClick={() => setFilter("needs_briefing")}
          active={filter === "needs_briefing"}
        />
      </div>
      {volunteers.length === 0 ? (
        <EmptyState
          title="No volunteers yet"
          description="Share the public signup link or add someone manually."
          action={
            canCreate ? (
              <Button asChild>
                <Link href="/volunteers/new">Add Volunteer</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <DataTable
          key={filter}
          data={rows}
          searchKeys={["full_name", "phone", "ward", "lga"]}
          onRowClick={(v) => router.push(`/volunteers/${v.id}`)}
          emptyMessage={
            filter === "trained"
              ? "No one is marked trained yet."
              : filter === "needs_briefing"
                ? "Everyone on the list has completed the briefing."
                : "No records found."
          }
          columns={[
            { key: "full_name", header: "Name" },
            { key: "phone", header: "Phone" },
            { key: "ward", header: "Ward" },
            { key: "lga", header: "LGA" },
            {
              key: "training_status",
              header: "Training",
              render: (v) => <TrainingBadge status={v.training_status} />,
            },
          ]}
        />
      )}
      {canCreate ? (
        <p className="text-xs text-muted-foreground">
          If Mark trained fails because the database is behind,{" "}
          <button type="button" className="underline underline-offset-2" onClick={() => void copyTrainingSql()}>
            copy the training SQL
          </button>{" "}
          and run it in Supabase.
        </p>
      ) : null}
    </div>
  );
}
