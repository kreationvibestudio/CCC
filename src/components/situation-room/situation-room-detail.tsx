"use client";

import type { ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { parsePartyVotes, RESULT_PARTIES, partyLabel, totalPartyVotes } from "@/lib/elections/parties";
import { formatPollingUnitCode } from "@/lib/polling-units/code";
import { formatDateTime } from "@/lib/utils";
import type { IncidentRow, ResultRow } from "@/lib/situation-room/race";

function person(
  profile: { full_name: string; phone?: string | null; email?: string | null } | null | undefined
) {
  if (!profile) return "—";
  const bits = [profile.full_name, profile.phone, profile.email].filter(Boolean);
  return bits.join(" · ");
}

function puLabel(pu: ResultRow["polling_units"] | IncidentRow["polling_units"]) {
  if (!pu) return "Not linked";
  return [formatPollingUnitCode(pu), pu.name, pu.ward, pu.lga].filter(Boolean).join(" · ");
}

function voteRows(raw: unknown) {
  const votes = parsePartyVotes(raw);
  const known = RESULT_PARTIES.map((p) => ({
    code: p.code,
    label: partyLabel(p.code),
    n: votes[p.code] ?? 0,
  })).filter((p) => p.n > 0);
  const extras = Object.entries(votes)
    .filter(([code]) => !RESULT_PARTIES.some((p) => p.code === code))
    .map(([code, n]) => ({ code, label: code, n }));
  return [...known, ...extras].sort((a, b) => b.n - a.n);
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-0.5 text-sm">{children}</div>
    </div>
  );
}

export function SituationRoomDetail({
  incident,
  result,
  onClose,
}: {
  incident: IncidentRow | null;
  result: ResultRow | null;
  onClose: () => void;
}) {
  const open = Boolean(incident || result);
  const votes = result ? voteRows(result.party_votes) : [];
  const total = result ? totalPartyVotes(parsePartyVotes(result.party_votes)) || result.total_votes : 0;
  const lat = incident?.latitude ?? result?.latitude ?? incident?.polling_units?.latitude ?? result?.polling_units?.latitude;
  const lng = incident?.longitude ?? result?.longitude ?? incident?.polling_units?.longitude ?? result?.polling_units?.longitude;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        {incident && (
          <>
            <DialogHeader>
              <DialogTitle>
                {incident.is_emergency ? "Emergency incident" : "Incident"} — {incident.title}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant={incident.severity === "high" || incident.severity === "critical" ? "destructive" : "secondary"}>
                  {incident.severity}
                </Badge>
                <Badge variant="outline">{(incident.status || "open").replace(/_/g, " ")}</Badge>
                {incident.is_emergency && <Badge variant="destructive">Emergency</Badge>}
              </div>
              <Field label="Logged">{formatDateTime(incident.created_at)}</Field>
              <Field label="Polling unit">{puLabel(incident.polling_units)}</Field>
              <Field label="Reported by">{person(incident.profiles)}</Field>
              <Field label="Description">
                <p className="whitespace-pre-wrap">{incident.description || "—"}</p>
              </Field>
              {lat != null && lng != null && (
                <Field label="GPS">
                  <a
                    className="text-primary underline-offset-4 hover:underline"
                    href={`https://maps.google.com/?q=${lat},${lng}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {Number(lat).toFixed(5)}, {Number(lng).toFixed(5)} — open map
                  </a>
                </Field>
              )}
            </div>
          </>
        )}
        {result && (
          <>
            <DialogHeader>
              <DialogTitle>Result sheet — {result.polling_units?.name ?? result.polling_units?.code ?? "Polling unit"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Field label="Logged">{formatDateTime(result.submitted_at)}</Field>
              <Field label="Polling unit">{puLabel(result.polling_units)}</Field>
              {result.polling_units?.registered_voters != null && (
                <Field label="Registered voters">{result.polling_units.registered_voters.toLocaleString()}</Field>
              )}
              <Field label="Submitted by">{person(result.profiles)}</Field>
              <Field label="Total votes">{(total || result.total_votes).toLocaleString()}</Field>
              <Field label="Party breakdown">
                {votes.length === 0 ? (
                  <p className="text-muted-foreground">No party figures on this sheet.</p>
                ) : (
                  <table className="w-full text-sm">
                    <tbody>
                      {votes.map((row) => (
                        <tr key={row.code} className="border-b border-border last:border-0">
                          <td className="py-1.5 pr-2">{row.label}</td>
                          <td className="py-1.5 text-right font-medium tabular-nums">{row.n.toLocaleString()}</td>
                          <td className="w-16 py-1.5 pl-2 text-right text-xs text-muted-foreground">
                            {total > 0 ? `${Math.round((row.n / total) * 100)}%` : ""}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Field>
              {lat != null && lng != null && (
                <Field label="GPS at submit">
                  <a
                    className="text-primary underline-offset-4 hover:underline"
                    href={`https://maps.google.com/?q=${lat},${lng}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {Number(lat).toFixed(5)}, {Number(lng).toFixed(5)} — open map
                  </a>
                </Field>
              )}
              {result.result_sheet_url && (
                <Button variant="outline" size="sm" asChild>
                  <a href={result.result_sheet_url} target="_blank" rel="noreferrer">
                    Open uploaded sheet
                  </a>
                </Button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
