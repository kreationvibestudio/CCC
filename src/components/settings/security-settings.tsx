"use client";

import { useState } from "react";
import { enrollMFA, verifyMFA } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export function SecuritySettings() {
  const [loading, setLoading] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);

  async function handleEnroll() {
    setLoading(true);
    const result = await enrollMFA();
    setLoading(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setFactorId(result.data?.id ?? null);
    setQrCode(result.data?.totp?.qr_code ?? null);
    toast.success("Scan the QR code with your authenticator app");
  }

  async function handleVerify(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!factorId) return;
    setLoading(true);
    const code = new FormData(e.currentTarget).get("code") as string;
    const result = await verifyMFA(factorId, code);
    setLoading(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Two-factor authentication enabled");
    setQrCode(null);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" /> Two-Factor Authentication
        </CardTitle>
        <CardDescription>Add an extra layer of security with TOTP</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!qrCode ? (
          <Button onClick={handleEnroll} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enable 2FA
          </Button>
        ) : (
          <div className="space-y-4">
            {qrCode && (
              <div className="rounded-lg border border-border p-4 text-xs break-all text-muted-foreground">
                QR URI: {qrCode.slice(0, 80)}...
              </div>
            )}
            <form onSubmit={handleVerify} className="flex gap-2">
              <div className="flex-1 space-y-2">
                <Label htmlFor="code">Verification Code</Label>
                <Input id="code" name="code" placeholder="000000" maxLength={6} required />
              </div>
              <Button type="submit" className="self-end" disabled={loading}>
                Verify
              </Button>
            </form>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
