import { PageHeader } from "@/components/shared/page-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

type Profile = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  ward: string | null;
  created_at: string;
};

export function AdminView({ profiles, auditCount }: { profiles: Profile[]; auditCount: number }) {
  return (
    <div className="space-y-6">
      <PageHeader title="Administration" description="Team members, roles and audit overview" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Card><CardContent className="py-6"><p className="text-sm text-muted-foreground">Team members</p><p className="text-2xl font-bold">{profiles.length}</p></CardContent></Card>
        <Card><CardContent className="py-6"><p className="text-sm text-muted-foreground">Audit log entries</p><p className="text-2xl font-bold">{auditCount}</p></CardContent></Card>
      </div>
      <div className="space-y-2">
        {profiles.map((p) => (
          <Card key={p.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div>
                <p className="font-medium">{p.full_name}</p>
                <p className="text-xs text-muted-foreground">{p.email}{p.ward ? ` · ${p.ward}` : ""}</p>
              </div>
              <Badge variant="secondary">{p.role.replace(/_/g, " ")}</Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
