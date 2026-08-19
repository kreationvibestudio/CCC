"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Contact, Plus } from "lucide-react";
import { PageHeader, StatCard } from "@/components/shared/page-shell";
import { DataTable } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Contact as ContactRow } from "@/types/database";

export function CrmView({ contacts }: { contacts: ContactRow[] }) {
  const router = useRouter();
  const supporters = contacts.filter((c) => c.support_level === "strong" || c.support_level === "leaning").length;
  return (
    <div className="space-y-6">
      <PageHeader title="Campaign CRM" description="Contacts, leaders, donors and supporters">
        <Button asChild><Link href="/crm/new"><Plus className="mr-2 h-4 w-4" />Add Contact</Link></Button>
      </PageHeader>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Total Contacts" value={contacts.length} icon={Contact} />
        <StatCard title="Supporters" value={supporters} />
        <StatCard title="Undecided" value={contacts.filter((c) => c.support_level === "undecided").length} />
      </div>
      <DataTable
        data={contacts}
        searchKeys={["full_name", "phone", "ward"]}
        onRowClick={(c) => router.push(`/crm/${c.id}`)}
        columns={[
          { key: "full_name", header: "Name" },
          { key: "contact_type", header: "Type", render: (c) => c.contact_type.replace(/_/g, " ") },
          { key: "phone", header: "Phone" },
          { key: "ward", header: "Ward" },
          { key: "support_level", header: "Support", render: (c) => <Badge>{c.support_level}</Badge> },
        ]}
      />
    </div>
  );
}
