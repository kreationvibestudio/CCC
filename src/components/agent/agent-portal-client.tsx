"use client";

import { useState, useTransition, useEffect } from "react";
import { PageHeader } from "@/components/shared/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  submitAgentReport,
  reportIncident,
  updatePuStatus,
  submitElectionResult,
  type AgentPollingUnit,
} from "@/lib/agent/actions";
import { ResultSheetForm } from "@/components/agent/result-sheet-form";
import { AgentReportForm } from "@/components/agent/agent-report-form";
import { PollingUnitPicker } from "@/components/agent/polling-unit-picker";
import { toast } from "sonner";
import { formatDateTime } from "@/lib/utils";

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
    if (!fd.get("captured_at") && item.at) fd.set("captured_at", new Date(item.at).toISOString());
    const result = await fn(fd);
    if (result.error) remaining.push(item);
    else synced += 1;
  }
  localStorage.setItem(OFFLINE_KEY, JSON.stringify(remaining));
  if (synced && !remaining.length) toast.success(`Synced ${synced} offline report(s)`);
  else if (synced) toast.success(`Synced ${synced}; ${remaining.length} still queued`);
  else if (remaining.length) toast.error("Could not sync offline reports — will retry when you are back online");
}

export function AgentPortalClient({ assigned }: { assigned: AgentPollingUnit[] }) {
  const [pending, startTransition] = useTransition();
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [selected, setSelected] = useState<AgentPollingUnit | null>(null);
  const [online, setOnline] = useState(true);
  const puId = selected?.id ?? "";

  const [clock, setClock] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

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

  function runAction(
    action: (fd: FormData) => Promise<{ error?: string; success?: boolean }>,
    fd: FormData,
    offlineLabel: OfflineAction
  ) {
    fd.set("captured_at", new Date().toISOString());
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
      else toast.success(`Submitted · ${formatDateTime(fd.get("captured_at") as string)}`);
    });
  }

  return (
    <div className="mx-auto min-h-screen max-w-lg space-y-6 bg-background p-4 pb-24">
      <PageHeader title="Agent Portal" description="Polling unit reporting">
        <div className="flex flex-col items-end gap-1">
          <span className={`rounded-full px-2 py-1 text-xs ${online ? "bg-green-500/20 text-green-700" : "bg-yellow-500/20"}`}>
            {online ? "Online" : "Offline"}
          </span>
          <span className="text-[11px] tabular-nums text-muted-foreground">
            Submit time: {formatDateTime(clock)}
          </span>
        </div>
      </PageHeader>

      <PollingUnitPicker
        assigned={assigned}
        selected={selected}
        coords={coords}
        onCoords={setCoords}
        onSelect={(unit) => setSelected(unit)}
      />

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
        <NativeSelect name="status">
          <option value="not_active">Not active</option>
          <option value="voting_in_progress">Voting in progress</option>
          <option value="voting_finished">Voting finished</option>
          <option value="delayed">Delayed</option>
          <option value="minor_issue">Minor issue</option>
          <option value="serious_incident">Serious incident</option>
        </NativeSelect>
        <Input name="turnout" type="number" placeholder="Turnout count" min={0} />
        <p className="text-xs text-muted-foreground">Date and time are recorded automatically when you tap submit.</p>
        <Button type="submit" disabled={pending || !puId} className="w-full">Update status</Button>
      </form>

      <AgentReportForm
        puId={puId}
        online={online}
        disabled={pending || !puId}
        onOffline={(data) => queueOffline("report", data)}
      />

      <ResultSheetForm
        disabled={pending || !puId}
        onSubmit={(partyVotesJson) => {
          const fd = new FormData();
          fd.set("polling_unit_id", puId);
          fd.set("party_votes", partyVotesJson);
          if (coords) {
            fd.set("latitude", String(coords.lat));
            fd.set("longitude", String(coords.lng));
          }
          runAction(submitElectionResult, fd, "results");
        }}
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          if (puId) fd.set("polling_unit_id", puId);
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
        <NativeSelect name="severity">
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </NativeSelect>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="is_emergency" value="true" /> Emergency
        </label>
        <p className="text-xs text-muted-foreground">Date and time are recorded automatically when you tap submit.</p>
        <Button type="submit" variant="destructive" disabled={pending} className="w-full">Report incident</Button>
      </form>
    </div>
  );
}
