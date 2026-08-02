import Link from "next/link";
import { Contact, Plus } from "lucide-react";
import { PageHeader, EmptyState, StatCard } from "@/components/shared/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Contact as ContactRow } from "@/types/database";

export function CrmView({ contacts }: { contacts: ContactRow[] }) {
  const supporters = contacts.filter((c) => c.support_level === "strong" || c.support_level === "leaning").length;
  return (
    <div className="space-y-6">
      <PageHeader title="Campaign CRM" description="Contacts, leaders, donors and supporters">
        <Button asChild>
          <Link href="/crm/new"><Plus className="mr-2 h-4 w-4" />Add Contact</Link>
        </Button>
      </PageHeader>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Total Contacts" value={contacts.length} icon={Contact} />
        <StatCard title="Supporters" value={supporters} />
        <StatCard title="Undecided" value={contacts.filter((c) => c.support_level === "undecided").length} />
      </div>
      {contacts.length === 0 ? (
        <EmptyState title="No contacts yet" description="Build your supporter database by adding contacts." />
      ) : (
        <div className="grid gap-3">
          {contacts.map((c) => (
            <Card key={c.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div>
                  <p className="font-medium">{c.full_name}</p>
                  <p className="text-sm text-muted-foreground">{c.contact_type.replace(/_/g, " ")}</p>
                  <p className="text-xs text-muted-foreground">{c.phone ?? c.email ?? "No contact info"}</p>
                </div>
                <Badge variant={c.support_level === "strong" ? "default" : "secondary"}>{c.support_level}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
