"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  FEATURED_PARTIES,
  OTHER_MAJOR_PARTIES,
  parsePartyVotes,
  totalPartyVotes,
  type PartyOption,
} from "@/lib/elections/parties";

function voteField(code: string) {
  return `vote_${code}`;
}

function PartyRows({
  parties,
  votes,
  onChange,
}: {
  parties: PartyOption[];
  votes: Record<string, string>;
  onChange: (code: string, value: string) => void;
}) {
  return (
    <div className="space-y-2">
      {parties.map((party) => (
        <div key={party.code} className="grid grid-cols-[minmax(0,1fr)_6.5rem] items-center gap-2">
          <Label htmlFor={voteField(party.code)} className="leading-tight">
            <span className="font-semibold">{party.code}</span>
            <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{party.name}</span>
          </Label>
          <Input
            id={voteField(party.code)}
            name={voteField(party.code)}
            inputMode="numeric"
            type="number"
            min={0}
            step={1}
            placeholder="0"
            value={votes[party.code] ?? ""}
            onChange={(e) => onChange(party.code, e.target.value.replace(/[^\d]/g, ""))}
            className="text-right"
          />
        </div>
      ))}
    </div>
  );
}

export function ResultSheetForm({
  disabled,
  onSubmit,
}: {
  disabled: boolean;
  onSubmit: (partyVotesJson: string) => void;
}) {
  const [votes, setVotes] = useState<Record<string, string>>({});
  const [extras, setExtras] = useState<{ id: number; code: string; votes: string }[]>([]);
  const [showOthers, setShowOthers] = useState(true);

  const totals = useMemo(() => {
    const payload: Record<string, number> = {};
    for (const [code, raw] of Object.entries(votes)) {
      if (raw === "") continue;
      payload[code] = Number(raw);
    }
    for (const extra of extras) {
      const code = extra.code.trim().toUpperCase();
      if (!code || extra.votes === "") continue;
      payload[code] = Number(extra.votes);
    }
    const parsed = parsePartyVotes(payload);
    return { parsed, total: totalPartyVotes(parsed) };
  }, [votes, extras]);

  function setVote(code: string, value: string) {
    setVotes((prev) => ({ ...prev, [code]: value }));
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(JSON.stringify(totals.parsed));
      }}
      className="space-y-3 rounded-xl border border-border p-4"
    >
      <div>
        <p className="font-medium">Submit results</p>
        <p className="text-xs text-muted-foreground">
          Enter votes from the result sheet. Leave blank for 0. APC, PDP, NDC, and ADC are listed first.
        </p>
      </div>

      <PartyRows parties={FEATURED_PARTIES} votes={votes} onChange={setVote} />

      <button
        type="button"
        className="text-sm text-primary underline-offset-4 hover:underline"
        onClick={() => setShowOthers((v) => !v)}
      >
        {showOthers ? "Hide other parties" : "Show other major parties"}
      </button>

      {showOthers && <PartyRows parties={OTHER_MAJOR_PARTIES} votes={votes} onChange={setVote} />}

      <div className="space-y-2">
        {extras.map((row) => (
          <div key={row.id} className="grid grid-cols-[minmax(0,1fr)_6.5rem] items-center gap-2">
            <Input
              placeholder="Party code"
              value={row.code}
              onChange={(e) =>
                setExtras((prev) =>
                  prev.map((p) => (p.id === row.id ? { ...p, code: e.target.value.toUpperCase() } : p))
                )
              }
            />
            <Input
              inputMode="numeric"
              type="number"
              min={0}
              placeholder="0"
              value={row.votes}
              onChange={(e) =>
                setExtras((prev) =>
                  prev.map((p) => (p.id === row.id ? { ...p, votes: e.target.value.replace(/[^\d]/g, "") } : p))
                )
              }
              className="text-right"
            />
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setExtras((prev) => [...prev, { id: Date.now(), code: "", votes: "" }])}
        >
          Add another party
        </Button>
      </div>

      <p className="text-sm font-medium">Total valid votes: {totals.total.toLocaleString()}</p>
      <Button type="submit" disabled={disabled} className="w-full">
        Submit results
      </Button>
    </form>
  );
}
