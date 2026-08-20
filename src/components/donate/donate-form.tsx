"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/utils";

const PRESETS = [1000, 5000, 10000, 25000, 50000, 100000];

export function DonateForm({ enabled }: { enabled: boolean }) {
  const [amount, setAmount] = useState(5000);
  const [custom, setCustom] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  const naira = custom.trim() ? Number(custom) : amount;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!enabled) {
      toast.error("Online donations are not open yet.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/donations/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: naira,
          email,
          fullName,
          phone,
        }),
      });
      const json = (await res.json()) as { authorizationUrl?: string; error?: string };
      if (!res.ok || !json.authorizationUrl) {
        toast.error(json.error ?? "Could not start checkout");
        return;
      }
      window.location.href = json.authorizationUrl;
    } catch {
      toast.error("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Amount (₦)</Label>
        <div className="grid grid-cols-3 gap-2">
          {PRESETS.map((value) => (
            <Button
              key={value}
              type="button"
              variant={!custom && amount === value ? "default" : "outline"}
              onClick={() => {
                setAmount(value);
                setCustom("");
              }}
            >
              {formatCurrency(value)}
            </Button>
          ))}
        </div>
        <Input
          inputMode="numeric"
          placeholder="Or enter another amount"
          value={custom}
          onChange={(e) => setCustom(e.target.value.replace(/[^\d]/g, ""))}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="fullName">Full name</Label>
        <Input
          id="fullName"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          autoComplete="name"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">Phone (optional)</Label>
        <Input
          id="phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          autoComplete="tel"
          placeholder="080…"
        />
      </div>
      <Button type="submit" className="w-full" disabled={loading || !enabled}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {enabled ? `Donate ${Number.isFinite(naira) && naira > 0 ? formatCurrency(naira) : ""}` : "Donations not configured"}
      </Button>
    </form>
  );
}
