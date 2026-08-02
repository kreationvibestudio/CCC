"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Users, Plus } from "lucide-react";
import { PageHeader, EmptyState, StatCard } from "@/components/shared/page-shell";
import { DataTable } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Volunteer } from "@/types/database";

export function VolunteersView({ volunteers }: { volunteers: Volunteer[] }) {
  const router = useRouter();
  const trained = volunteers.filter((v) => v.training_status === "completed").length;
  return (
    <div className="space-y-6">
      <PageHeader title="Volunteers" description="Manage field volunteers and coordinators">
        <Button asChild><Link href="/volunteers/new"><Plus className="mr-2 h-4 w-4" />Add Volunteer</Link></Button>
      </PageHeader>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Total Volunteers" value={volunteers.length} icon={Users} />
        <StatCard title="Trained" value={trained} />
        <StatCard title="Pending Training" value={volunteers.length - trained} />
      </div>
      {volunteers.length === 0 ? (
        <EmptyState title="No volunteers yet" description="Add your first volunteer." action={<Button asChild><Link href="/volunteers/new">Add Volunteer</Link></Button>} />
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
            { key: "training_status", header: "Training", render: (v) => <Badge variant="secondary">{v.training_status}</Badge> },
          ]}
        />
      )}
    </div>
  );
}
