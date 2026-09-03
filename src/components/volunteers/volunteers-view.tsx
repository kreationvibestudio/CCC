"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Users, Plus, Copy, ExternalLink } from "lucide-react";
import { PageHeader, EmptyState, StatCard } from "@/components/shared/page-shell";
import { DataTable } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { Volunteer } from "@/types/database";

export function VolunteersView({
  volunteers,
  signupUrl = "",
}: {
  volunteers: Volunteer[];
  signupUrl?: string;
}) {
  const router = useRouter();
  const trained = volunteers.filter((v) => v.training_status === "completed").length;

  function copySignupLink() {
    if (!signupUrl) {
      toast.error("Set NEXT_PUBLIC_APP_URL to share the public signup link");
      return;
    }
    void navigator.clipboard.writeText(signupUrl);
    toast.success("Volunteer signup link copied");
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Volunteers" description="Manage field volunteers and coordinators">
        <Button asChild>
          <Link href="/volunteers/new">
            <Plus className="mr-2 h-4 w-4" />
            Add Volunteer
          </Link>
        </Button>
      </PageHeader>

      {signupUrl ? (
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-sm font-medium">Public signup link</p>
              <p className="text-xs text-muted-foreground">
                Put this on{" "}
                <a
                  className="underline underline-offset-2"
                  href="https://akhakonanenih.info"
                  target="_blank"
                  rel="noreferrer"
                >
                  akhakonanenih.info
                </a>{" "}
                as a Volunteer button so people can register themselves.
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
        <StatCard title="Total Volunteers" value={volunteers.length} icon={Users} />
        <StatCard title="Trained" value={trained} />
        <StatCard title="Pending Training" value={volunteers.length - trained} />
      </div>
      {volunteers.length === 0 ? (
        <EmptyState
          title="No volunteers yet"
          description="Share the public signup link or add someone manually."
          action={
            <Button asChild>
              <Link href="/volunteers/new">Add Volunteer</Link>
            </Button>
          }
        />
      ) : (
        <DataTable
          data={volunteers}
          searchKeys={["full_name", "phone", "ward", "lga"]}
          onRowClick={(v) => router.push(`/volunteers/${v.id}`)}
          columns={[
            { key: "full_name", header: "Name" },
            { key: "phone", header: "Phone" },
            { key: "ward", header: "Ward" },
            { key: "lga", header: "LGA" },
            {
              key: "training_status",
              header: "Training",
              render: (v) => <Badge variant="secondary">{v.training_status}</Badge>,
            },
          ]}
        />
      )}
    </div>
  );
}
