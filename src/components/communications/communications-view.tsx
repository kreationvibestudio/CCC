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
      <PageHeader title="Communications" description="WhatsApp, SMS and email campaigns">
        <Button asChild><Link href="/communications/new">New Template</Link></Button>
      </PageHeader>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Message Templates ({templates.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {templates.length === 0 ? (
              <p className="text-sm text-muted-foreground">No templates yet.</p>
            ) : templates.map((t) => (
              <div key={t.id} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{t.name}</p>
                  <Badge variant="outline">{t.channel}</Badge>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{t.body}</p>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Campaigns ({campaigns.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {campaigns.length === 0 ? (
              <p className="text-sm text-muted-foreground">Draft campaigns appear here.</p>
            ) : campaigns.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.channel} · {c.sent_count ?? 0} sent</p>
                </div>
                <Badge>{c.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
