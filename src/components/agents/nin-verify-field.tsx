"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getVerifyMeStatus,
  verifyAgentNin,
  type NinVerificationPreview,
} from "@/lib/integrations/verifyme/actions";
import { photoDataUrl } from "@/lib/integrations/verifyme/helpers";

type Props = {
  disabled?: boolean;
  fullName: string;
  dateOfBirth: string;
  onDateOfBirthChange?: (value: string) => void;
  initialNin?: string;
  initialVerifiedAt?: string | null;
  initialVerification?: Record<string, unknown> | null;
  initialPhotoUrl?: string | null;
  onVerified?: (preview: NinVerificationPreview) => void;
  onCleared?: () => void;
};

export function NinVerifyField({
  disabled,
  fullName,
  dateOfBirth,
  onDateOfBirthChange,
  initialNin = "",
  initialVerifiedAt = null,
  initialVerification = null,
  initialPhotoUrl = null,
  onVerified,
  onCleared,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [nin, setNin] = useState(initialNin);
  const [preview, setPreview] = useState<NinVerificationPreview | null>(() => {
    if (!initialVerifiedAt || !initialVerification) return null;
    const v = initialVerification;
    const storedPhoto =
      typeof v.photo === "string" ? photoDataUrl(v.photo) : null;
    return {
      nin: String(v.nin ?? initialNin),
      firstname: String(v.firstname ?? ""),
      lastname: String(v.lastname ?? ""),
      middlename: v.middlename != null ? String(v.middlename) : null,
      phone: v.phone != null ? String(v.phone) : null,
      gender: v.gender != null ? String(v.gender) : null,
      birthdate: v.birthdate != null ? String(v.birthdate) : null,
      photoUrl: initialPhotoUrl || storedPhoto,
      fieldMatches: (v.fieldMatches as NinVerificationPreview["fieldMatches"]) ?? undefined,
      storage: v,
      demo: Boolean(v.demo),
    };
  });
  const [providerHint, setProviderHint] = useState<string | null>(null);

  useEffect(() => {
    void getVerifyMeStatus().then((s) => {
      if (s.provider === "lumiid") {
        setProviderHint("LumiID connected — live NIMC checks use LUMIID_SECRET_KEY.");
      } else if (s.provider === "qoreid") {
        setProviderHint("QoreID connected — live NIMC checks use your QoreID test/live keys.");
      } else if (s.provider === "verifyme") {
        setProviderHint("VerifyMe connected — live NIMC checks use VERIFYME_API_KEY.");
      } else if (s.demoMode) {
        setProviderHint(
          "Demo mode: LumiID sandbox NIN 89184072280 / Adaeze Okonkwo (set LUMIID_DEMO_MODE=true)."
        );
      } else {
        setProviderHint(null);
      }
    });
  }, []);

  function clearVerification() {
    setPreview(null);
    onCleared?.();
  }

  function handleVerify() {
    startTransition(async () => {
      const result = await verifyAgentNin({
        nin,
        fullName,
        dateOfBirth,
      });
      if (result.error || !result.preview) {
        clearVerification();
        toast.error(result.error ?? "NIN verification failed");
        return;
      }
      setPreview(result.preview);
      onVerified?.(result.preview);
      toast.success(result.preview.demo ? "NIN verified (demo persona)" : "NIN verified");
    });
  }

  const verifiedAt = preview?.storage?.verified_at
    ? String(preview.storage.verified_at)
    : initialVerifiedAt;

  return (
    <div className="space-y-3 sm:col-span-2 rounded-lg border border-border/70 bg-muted/20 p-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="date_of_birth">Date of birth</Label>
          <Input
            id="date_of_birth"
            name="date_of_birth"
            type="text"
            inputMode="numeric"
            autoComplete="bday"
            required
            disabled={disabled || pending}
            placeholder="YYYY-MM-DD or DD-MM-YYYY"
            value={dateOfBirth}
            onChange={(e) => {
              onDateOfBirthChange?.(e.target.value);
              clearVerification();
            }}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="nin">National Identification Number (NIN)</Label>
          <Input
            id="nin"
            name="nin"
            inputMode="numeric"
            autoComplete="off"
            required
            maxLength={14}
            placeholder="11 digits"
            disabled={disabled || pending}
            value={nin}
            onChange={(e) => {
              setNin(e.target.value);
              clearVerification();
            }}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={disabled || pending || !nin.trim() || !dateOfBirth || fullName.trim().length < 2}
          onClick={handleVerify}
        >
          {pending ? "Verifying…" : "Verify NIN"}
        </Button>
        {preview ? (
          <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
            Verified
            {preview.provider ? ` · ${preview.provider}` : ""}
            {preview.demo ? " (demo)" : ""}
            {verifiedAt ? ` · ${new Date(verifiedAt).toLocaleString()}` : ""}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">
            Verify NIN to unlock save — returns photo and identity match for security checks
          </span>
        )}
      </div>

      {providerHint ? <p className="text-xs text-muted-foreground">{providerHint}</p> : null}

      <input type="hidden" name="nin_verified_at" value={preview ? String(verifiedAt ?? "") : ""} />
      <input
        type="hidden"
        name="nin_verification_json"
        value={preview ? JSON.stringify(preview.storage) : ""}
      />

      {preview ? (
        <div className="flex flex-wrap gap-4 rounded-md border border-border bg-background p-3">
          {preview.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- base64 / remote NIMC photo
            <img
              src={preview.photoUrl}
              alt="NIN photograph"
              className="h-28 w-24 rounded object-cover border border-border"
            />
          ) : (
            <div className="flex h-28 w-24 items-center justify-center rounded border border-dashed border-border text-xs text-muted-foreground">
              No photo
            </div>
          )}
          <div className="min-w-[12rem] space-y-1 text-sm">
            <p className="font-medium">
              {[preview.firstname, preview.middlename, preview.lastname].filter(Boolean).join(" ")}
            </p>
            <p className="text-muted-foreground">NIN · {preview.nin}</p>
            {preview.gender ? <p className="text-muted-foreground">Gender · {preview.gender}</p> : null}
            {preview.birthdate ? (
              <p className="text-muted-foreground">Birthdate · {preview.birthdate}</p>
            ) : null}
            {preview.phone ? <p className="text-muted-foreground">NIMC phone · {preview.phone}</p> : null}
            {preview.address ? (
              <p className="text-muted-foreground">Address · {preview.address}</p>
            ) : null}
            {preview.matchStatus ? (
              <p className="text-xs text-muted-foreground">Match status · {preview.matchStatus}</p>
            ) : null}
            {preview.fieldMatches ? (
              <p className="text-xs text-muted-foreground">
                Matches · name{" "}
                {preview.fieldMatches.firstname && preview.fieldMatches.lastname ? "yes" : "check"} · DOB{" "}
                {preview.fieldMatches.dob ? "yes" : "check"}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
