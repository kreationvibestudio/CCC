"use client";

import Link from "next/link";
import { PageHeader } from "@/components/shared/page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { MessageTemplate, MessageCampaign } from "@/types/database";

export function CommunicationsView({
  templates,
  campaigns,
}: {
  templates: MessageTemplate[];
  campaigns: MessageCampaign[];
}) {
  return (
    <div className="space-y-6">
      <PageHeader title="Communications" description="Termii SMS campaigns and templates">
        <div className="flex gap-2">
          <Button asChild><Link href="/communications/new">New template</Link></Button>
          <Button variant="outline" asChild><Link href="/communications/campaigns/new">New campaign</Link></Button>
        </div>
      </PageHeader>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Templates ({templates.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {templates.map((t) => (
              <div key={t.id} className="rounded-lg border border-border p-3">
                <div className="flex justify-between"><p className="font-medium">{t.name}</p><Badge variant="outline">{t.channel}</Badge></div>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{t.body}</p>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Campaigns ({campaigns.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {campaigns.map((c) => (
              <div key={c.id} className="flex justify-between rounded-lg border border-border p-3">
                <div><p className="font-medium">{c.name}</p><p className="text-xs text-muted-foreground">{c.channel} · {c.sent_count ?? 0} sent</p></div>
                <Badge>{c.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
