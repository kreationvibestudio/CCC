"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { PageHeader, EmptyState } from "@/components/shared/page-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getAgentsTableMigrationSql, type AgentListItem } from "@/lib/agents/registration";
import { usePermissions } from "@/components/providers/auth-provider";
import { formatDate } from "@/lib/utils";
import { Plus, UserCheck } from "lucide-react";

export function AgentsListView({
  agents,
  needsAgentsMigration = false,
}: {
  agents: AgentListItem[];
  needsAgentsMigration?: boolean;
}) {
  const { canCreate } = usePermissions();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return agents;
    return agents.filter((a) =>
      [a.full_name, a.phone, a.pu_code, a.ward, a.membership_card_number, a.voters_card_number, a.nin]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [agents, search]);

  async function copyAgentsSql() {
    const result = await getAgentsTableMigrationSql();
    if ("error" in result && result.error) {
      toast.error(result.error);
      return;
    }
    await navigator.clipboard.writeText(result.sql);
    toast.success("Agents table SQL copied. Paste in Supabase SQL editor, then Run.");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agents"
        description="Registered polling-unit agents — paperwork records tied to units and field logins"
      >
        {canCreate ? (
          <Button asChild>
            <Link href="/agents/new">
              <Plus className="mr-2 h-4 w-4" />
              Register agent
            </Link>
          </Button>
        ) : null}
      </PageHeader>

      {needsAgentsMigration ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <p className="font-medium">One SQL apply creates the Agents registration table</p>
          <p className="mt-1 text-muted-foreground">
            Run this once in Supabase so registrations can be stored under Agents.
          </p>
          <div className="mt-3">
            <Button type="button" size="sm" onClick={() => void copyAgentsSql()}>
              Copy Agents table SQL
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, phone, PU, membership…"
          className="max-w-sm"
        />
        <Badge variant="secondary">{filtered.length} shown</Badge>
        <Button type="button" variant="outline" size="sm" asChild>
          <Link href="/polling-units/agents">
            <UserCheck className="mr-2 h-4 w-4" />
            PU codes &amp; check-ins
          </Link>
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={agents.length === 0 ? "No agents registered yet" : "No agents match"}
          description={
            agents.length === 0
              ? "Register an agent with state → ward → polling unit, NIN verification, voter card, phone, and optional membership card."
              : "Try a different search."
          }
          action={
            canCreate && agents.length === 0 ? (
              <Button asChild>
                <Link href="/agents/new">Register agent</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((agent) => (
            <Card key={agent.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3">
                <Link href={`/agents/${agent.id}`} className="flex min-w-0 flex-1 items-start gap-3">
                  {agent.passport_photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={agent.passport_photo_url}
                      alt=""
                      className="h-14 w-11 shrink-0 rounded object-cover"
                    />
                  ) : (
                    <div className="flex h-14 w-11 shrink-0 items-center justify-center rounded border border-dashed border-input text-[10px] text-muted-foreground">
                      No photo
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-medium">{agent.full_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {agent.pu_code}
                      {agent.pu_name ? ` — ${agent.pu_name}` : ""}
                      {agent.ward || agent.pu_ward
                        ? ` · ${agent.ward || agent.pu_ward}`
                        : ""}
                      {agent.pu_lga ? `, ${agent.pu_lga}` : ""}
                      {agent.phone ? ` · ${agent.phone}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {[
                        agent.nin ? `NIN ${agent.nin}` : null,
                        agent.membership_card_number
                          ? `Membership ${agent.membership_card_number}`
                          : null,
                        agent.voters_card_number ? `PVC ${agent.voters_card_number}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "No NIN / membership / PVC on file"}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {agent.nin_verified_at ? (
                        <Badge variant="secondary">NIN verified</Badge>
                      ) : null}
                      {agent.collation_label ? (
                        <Badge variant="secondary">{agent.collation_label}</Badge>
                      ) : null}
                      <span className="text-xs text-muted-foreground">
                        Registered {formatDate(agent.created_at)}
                      </span>
                    </div>
                  </div>
                </Link>
                <Button type="button" size="sm" variant="outline" asChild>
                  <Link href={`/agents/${agent.id}`}>Open</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
