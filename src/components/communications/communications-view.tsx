"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { MessageTemplate, MessageCampaign } from "@/types/database";

const SUPPORT_LEVELS = ["strong", "leaning", "undecided", "opposed"] as const;

export function CommunicationsView({
  templates,
  campaigns,
}: {
  templates: MessageTemplate[];
  campaigns: MessageCampaign[];
}) {
  const smsTemplates = useMemo(
    () => templates.filter((t) => t.channel === "sms"),
    [templates]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Communications"
        description="Create SMS templates and send Termii broadcasts to CRM contacts"
      >
        <div className="flex gap-2">
          <Button asChild>
            <Link href="/communications/new">New template</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/communications/campaigns/new">New campaign</Link>
          </Button>
        </div>
      </PageHeader>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Templates ({templates.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {templates.length === 0 ? (
              <p className="text-sm text-muted-foreground">No templates yet.</p>
            ) : (
              templates.map((t) => (
                <div key={t.id} className="rounded-lg border border-border p-3">
                  <div className="flex justify-between gap-2">
                    <p className="font-medium">{t.name}</p>
                    <Badge variant="outline">{t.channel}</Badge>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{t.body}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Campaigns ({campaigns.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {campaigns.length === 0 ? (
              <p className="text-sm text-muted-foreground">No campaigns yet.</p>
            ) : (
              campaigns.map((c) => (
                <div
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.channel} · {c.sent_count ?? 0} sent
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge>{c.status}</Badge>
                    {c.status === "draft" && c.channel === "sms" && (
                      <SendCampaignDialog campaign={c} templates={smsTemplates} />
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SendCampaignDialog({
  campaign,
  templates,
}: {
  campaign: MessageCampaign;
  templates: MessageTemplate[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [templateId, setTemplateId] = useState(campaign.template_id ?? templates[0]?.id ?? "");
  const [ward, setWard] = useState("");
  const [supportLevel, setSupportLevel] = useState("");

  async function handleSend() {
    if (!templateId) {
      toast.error("Select an SMS template before sending");
      return;
    }

    const confirmed = window.confirm(
      `Send SMS campaign “${campaign.name}” to matching CRM contacts (up to 100)?`
    );
    if (!confirmed) return;

    setLoading(true);
    try {
      const res = await fetch("/api/communications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId: campaign.id,
          templateId,
          ...(ward.trim() ? { ward: ward.trim() } : {}),
          ...(supportLevel ? { supportLevel } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Send failed", { duration: 10000 });
        return;
      }
      toast.success(
        `Sent ${data.sent} SMS${data.failed ? ` (${data.failed} failed)` : ""}`
      );
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("Could not reach the send API. Check Termii configuration.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary">
          <Send className="mr-1.5 h-3.5 w-3.5" />
          Send
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send “{campaign.name}”</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Dispatches via Termii to CRM contacts with phone numbers. Optional filters
            narrow the audience.
          </p>
          <div className="space-y-1">
            <Label htmlFor={`tpl-${campaign.id}`}>SMS template</Label>
            <NativeSelect
              id={`tpl-${campaign.id}`}
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              disabled={loading || templates.length === 0}
            >
              {templates.length === 0 ? (
                <option value="">No SMS templates — create one first</option>
              ) : (
                templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))
              )}
            </NativeSelect>
            <Input
              id={`ward-${campaign.id}`}
              value={ward}
              onChange={(e) => setWard(e.target.value)}
              placeholder="e.g. Ward 3"
              disabled={loading}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`support-${campaign.id}`}>Support level (optional)</Label>
            <NativeSelect
              id={`support-${campaign.id}`}
              value={supportLevel}
              onChange={(e) => setSupportLevel(e.target.value)}
              disabled={loading}
            >
              <option value="">All contacts</option>
              {SUPPORT_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </NativeSelect>
          </div>
          <Button
            className="w-full"
            onClick={handleSend}
            disabled={loading || !templateId}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending…
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Send SMS broadcast
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
