"use client";

import { useCallback, useEffect, useState } from "react";
import { getTermiiWallet } from "@/lib/integrations/termii/actions";
import { formatTermiiWallet, termiiWalletFill, termiiWalletTone } from "@/lib/integrations/termii/wallet";
import { cn } from "@/lib/utils";

const POLL_MS = 60_000;

function DialRing({ fill, tone }: { fill: number; tone: "ok" | "low" | "empty" | "idle" }) {
  const radius = 16;
  const circ = 2 * Math.PI * radius;
  const offset = circ * (1 - fill);
  const color =
    tone === "ok"
      ? "stroke-emerald-400"
      : tone === "low"
        ? "stroke-amber-400"
        : tone === "empty"
          ? "stroke-red-400"
          : "stroke-muted-foreground/40";
  return (
    <svg viewBox="0 0 40 40" className="h-10 w-10 shrink-0" aria-hidden="true">
      <circle
        cx="20"
        cy="20"
        r={radius}
        fill="none"
        className="stroke-muted/60"
        strokeWidth="4"
      />
      <circle
        cx="20"
        cy="20"
        r={radius}
        fill="none"
        className={color}
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        transform="rotate(-90 20 20)"
      />
    </svg>
  );
}

export function TermiiWalletDial({ refreshKey = 0 }: { refreshKey?: number }) {
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "ok"; balance: number; currency: string }
    | { status: "error"; error: string }
  >({ status: "loading" });

  const load = useCallback(async () => {
    setState({ status: "loading" });
    const result = await getTermiiWallet();
    if (!result.ok) {
      setState({ status: "error", error: result.error || "Could not read the Termii wallet." });
      return;
    }
    setState({ status: "ok", balance: result.balance, currency: result.currency });
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      void load();
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [load, refreshKey]);

  const label =
    state.status === "ok"
      ? `Termii wallet ${formatTermiiWallet(state.balance, state.currency)}. Click to refresh.`
      : state.status === "error"
        ? `${state.error} Click to retry.`
        : "Checking Termii wallet…";

  return (
    <button
      type="button"
      onClick={() => void load()}
      title={label}
      aria-label={label}
      className={cn(
        "inline-flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-left transition-colors",
        "hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        state.status === "ok" && termiiWalletTone(state.balance) === "empty"
          ? "border-red-500/40"
          : state.status === "ok" && termiiWalletTone(state.balance) === "low"
            ? "border-amber-500/40"
            : "border-border"
      )}
    >
      {state.status === "ok" ? (
        <DialRing fill={termiiWalletFill(state.balance)} tone={termiiWalletTone(state.balance)} />
      ) : (
        <DialRing fill={state.status === "loading" ? 0.2 : 0} tone="idle" />
      )}
      <span className="min-w-0">
        <span className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Termii wallet
        </span>
        {state.status === "ok" ? (
          <span
            className={cn(
              "block font-mono text-sm font-semibold tabular-nums",
              termiiWalletTone(state.balance) === "empty" && "text-red-400",
              termiiWalletTone(state.balance) === "low" && "text-amber-300"
            )}
          >
            {formatTermiiWallet(state.balance, state.currency)}
          </span>
        ) : state.status === "error" ? (
          <span className="block text-xs text-muted-foreground">Unavailable — click to retry</span>
        ) : (
          <span className="block text-xs text-muted-foreground">Checking…</span>
        )}
      </span>
    </button>
  );
}
