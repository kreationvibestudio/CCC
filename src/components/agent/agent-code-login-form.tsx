"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BrandLogo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

function formatCodeInput(raw: string) {
  const compact = raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  if (compact.length <= 4) return compact;
  return `${compact.slice(0, 4)}-${compact.slice(4)}`;
}

async function readGpsOptional(): Promise<{ latitude: number; longitude: number } | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return null;
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 30_000 }
    );
  });
}

export function AgentCodeLoginForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    if (code.replace(/[^A-Z0-9]/gi, "").length !== 8) {
      setError("Enter the 8-character code HQ gave you");
      return;
    }
    setLoading(true);
    try {
      const gps = await readGpsOptional();
      if (!gps) setInfo("GPS unavailable — signing in with your agent code only.");
      const res = await fetch("/api/agent/code-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          latitude: gps?.latitude ?? null,
          longitude: gps?.longitude ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sign in failed");

      const supabase = createClient();
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });
      if (sessionError) throw new Error(sessionError.message);

      router.replace("/agent");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[radial-gradient(ellipse_at_top,_#1e3a5f_0%,_#0b1220_55%,_#060a12_100%)] px-4 py-12">
      <form
        onSubmit={(e) => void onSubmit(e)}
        className="w-full max-w-md space-y-5 text-center text-white"
      >
        <div className="flex justify-center">
          <BrandLogo size={80} priority />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Field Agent sign-in</h1>
          <p className="mt-2 text-sm text-white/70">
            Enter the code from HQ (Polling units → PU Agents). Location is checked when your browser allows it.
          </p>
        </div>
        <Input
          value={code}
          onChange={(e) => setCode(formatCodeInput(e.target.value))}
          placeholder="XXXX-XXXX"
          autoComplete="one-time-code"
          className="h-14 border-white/20 bg-white/10 text-center text-2xl font-bold tracking-[0.35em] text-white placeholder:text-white/40"
          aria-label="Agent access code"
        />
        {error ? <p className="text-sm text-red-300">{error}</p> : null}
        {info ? <p className="text-sm text-amber-200/90">{info}</p> : null}
        <Button type="submit" className="h-12 w-full text-base" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </Button>
        <p className="text-xs text-white/50">Prefer the CCC Agent mobile app? Same code works there.</p>
      </form>
    </div>
  );
}
