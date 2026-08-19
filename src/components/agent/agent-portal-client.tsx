"use client";

import { useState, useTransition, useEffect } from "react";
import { PageHeader } from "@/components/shared/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitAgentReport, reportIncident, updatePuStatus, submitElectionResult } from "@/lib/agent/actions";
import { toast } from "sonner";

type PU = { id: string; code: string; name: string; ward: string; lga: string };

const OFFLINE_KEY = "ccc-agent-queue";

const OFFLINE_ACTIONS = {
  status: updatePuStatus,
  report: submitAgentReport,
  results: submitElectionResult,
  incident: reportIncident,
} as const;

type OfflineAction = keyof typeof OFFLINE_ACTIONS;

function readQueue(): { action: OfflineAction; data: Record<string, string>; at: number }[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(OFFLINE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function queueOffline(action: OfflineAction, data: Record<string, string>) {
  const q = readQueue();
  q.push({ action, data, at: Date.now() });
  localStorage.setItem(OFFLINE_KEY, JSON.stringify(q));
}

async function flushQueue() {
  const q = readQueue();
  if (!q.length) return;
  const remaining: typeof q = [];
  let synced = 0;
  for (const item of q) {
    const fn = OFFLINE_ACTIONS[item.action];
    if (!fn) continue;
    const fd = new FormData();
    for (const [key, value] of Object.entries(item.data)) fd.set(key, value);
    const result = await fn(fd);
    if (result.error) remaining.push(item);
    else synced += 1;
  }
  localStorage.setItem(OFFLINE_KEY, JSON.stringify(remaining));
  if (synced && !remaining.length) toast.success(`Synced ${synced} offline report(s)`);
  else if (synced) toast.success(`Synced ${synced}; ${remaining.length} still queued`);
  else if (remaining.length) toast.error("Could not sync offline reports — will retry when you are back online");
}

export function AgentPortalClient({ units }: { units: PU[] }) {
  const [pending, startTransition] = useTransition();
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [puId, setPuId] = useState(units[0]?.id ?? "");
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    if (navigator.onLine) void flushQueue();
    const on = () => {
      setOnline(true);
      void flushQueue();
    };
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  function getLocation() {
    navigator.geolocation?.getCurrentPosition(
      (p) => setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => toast.error("Could not get GPS")
    );
  }

  function runAction(
    action: (fd: FormData) => Promise<{ error?: string; success?: boolean }>,
    fd: FormData,
    offlineLabel: OfflineAction
  ) {
    if (!online) {
      const data: Record<string, string> = {};
      fd.forEach((v, k) => {
        data[k] = String(v);
      });
      queueOffline(offlineLabel, data);
      toast.info("Saved offline — will sync when connected");
      return;
    }
    startTransition(async () => {
      const result = await action(fd);
      if (result.error) toast.error(result.error);
      else toast.success("Submitted");
    });
  }

  return (
    <div className="mx-auto min-h-screen max-w-lg space-y-6 bg-background p-4 pb-24">
      <PageHeader title="Agent Portal" description="Polling unit reporting">
        <span className={`rounded-full px-2 py-1 text-xs ${online ? "bg-green-500/20 text-green-700" : "bg-yellow-500/20"}`}>
          {online ? "Online" : "Offline"}
        </span>
      </PageHeader>

      <div className="space-y-1">
        <Label>Polling unit</Label>
        <select
          value={puId}
          onChange={(e) => setPuId(e.target.value)}
          className="flex h-9 w-full rounded-md border border-input px-3 text-sm"
        >
          {units.map((u) => (
            <option key={u.id} value={u.id}>{u.code} — {u.name}</option>
          ))}
        </select>
      </div>

      <Button variant="outline" className="w-full" onClick={getLocation} type="button">
        {coords ? `GPS: ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}` : "Capture GPS"}
      </Button>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          fd.set("polling_unit_id", puId);
          if (coords) {
            fd.set("latitude", String(coords.lat));
            fd.set("longitude", String(coords.lng));
          }
          runAction(updatePuStatus, fd, "status");
        }}
        className="space-y-3 rounded-xl border border-border p-4"
      >
        <p className="font-medium">PU Status & Turnout</p>
        <select name="status" className="flex h-9 w-full rounded-md border border-input px-3 text-sm">
          <option value="not_active">Not active</option>
          <option value="voting_in_progress">Voting in progress</option>
          <option value="delayed">Delayed</option>
          <option value="minor_issue">Minor issue</option>
          <option value="serious_incident">Serious incident</option>
        </select>
        <Input name="turnout" type="number" placeholder="Turnout count" min={0} />
        <Button type="submit" disabled={pending || !puId} className="w-full">Update status</Button>
      </form>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          fd.set("polling_unit_id", puId);
          runAction(submitAgentReport, fd, "report");
        }}
        className="space-y-3 rounded-xl border border-border p-4"
      >
        <p className="font-medium">Field report</p>
        <select name="report_type" className="flex h-9 w-full rounded-md border border-input px-3 text-sm">
          <option value="turnout">Turnout update</option>
          <option value="logistics">Logistics</option>
          <option value="observation">Observation</option>
        </select>
        <textarea name="content" required rows={3} className="flex w-full rounded-md border border-input px-3 py-2 text-sm" placeholder="Report details…" />
        <Button type="submit" disabled={pending || !puId} className="w-full">Submit report</Button>
      </form>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          fd.set("polling_unit_id", puId);
          fd.set("party_votes", JSON.stringify({
            APC: Number(fd.get("apc_votes")),
            PDP: Number(fd.get("pdp_votes")),
            LP: Number(fd.get("lp_votes")),
          }));
          if (coords) {
            fd.set("latitude", String(coords.lat));
            fd.set("longitude", String(coords.lng));
          }
          runAction(submitElectionResult, fd, "results");
        }}
        className="space-y-3 rounded-xl border border-border p-4"
      >
        <p className="font-medium">Submit results</p>
        <Input name="apc_votes" type="number" placeholder="APC votes" min={0} required />
        <Input name="pdp_votes" type="number" placeholder="PDP votes" min={0} required />
        <Input name="lp_votes" type="number" placeholder="LP votes" min={0} />
        <Button type="submit" disabled={pending || !puId} className="w-full">Submit results</Button>
      </form>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          if (coords) {
            fd.set("latitude", String(coords.lat));
            fd.set("longitude", String(coords.lng));
          }
          runAction(reportIncident, fd, "incident");
        }}
        className="space-y-3 rounded-xl border border-destructive/40 p-4"
      >
        <p className="font-medium text-destructive">Report incident</p>
        <Input name="title" placeholder="Title" required />
        <textarea name="description" required rows={2} className="flex w-full rounded-md border border-input px-3 py-2 text-sm" />
        <select name="severity" className="flex h-9 w-full rounded-md border border-input px-3 text-sm">
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="is_emergency" value="true" /> Emergency
        </label>
        <Button type="submit" variant="destructive" disabled={pending} className="w-full">Report incident</Button>
      </form>
    </div>
  );
}
