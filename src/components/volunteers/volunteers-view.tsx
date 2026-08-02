import Link from "next/link";
import { Users, Plus } from "lucide-react";
import { PageHeader, EmptyState, StatCard } from "@/components/shared/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Volunteer } from "@/types/database";

export function VolunteersView({ volunteers }: { volunteers: Volunteer[] }) {
  const trained = volunteers.filter((v) => v.training_status === "completed").length;
  return (
    <div className="space-y-6">
      <PageHeader title="Volunteers" description="Manage field volunteers and coordinators">
        <Button asChild>
          <Link href="/volunteers/new"><Plus className="mr-2 h-4 w-4" />Add Volunteer</Link>
        </Button>
      </PageHeader>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Total Volunteers" value={volunteers.length} icon={Users} />
        <StatCard title="Trained" value={trained} />
        <StatCard title="Pending Training" value={volunteers.length - trained} />
      </div>
      {volunteers.length === 0 ? (
        <EmptyState
          title="No volunteers yet"
          description="Add your first volunteer to start building your field team."
          action={<Button asChild><Link href="/volunteers/new">Add Volunteer</Link></Button>}
        />
      ) : (
        <div className="grid gap-3">
          {volunteers.map((v) => (
            <Card key={v.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div>
                  <p className="font-medium">{v.full_name}</p>
                  <p className="text-sm text-muted-foreground">{v.phone}{v.email ? ` · ${v.email}` : ""}</p>
                  <p className="text-xs text-muted-foreground">{[v.ward, v.lga].filter(Boolean).join(", ") || "No location"}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{v.training_status}</Badge>
                  {v.skills?.slice(0, 2).map((s) => <Badge key={s} variant="outline">{s}</Badge>)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
