"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { refreshFacebookCommentAuthors } from "@/lib/comments/actions";
import {
  BUSINESS_DOCUMENTS_HELP_URL,
  BUSINESS_VERIFICATION_PLAYBOOK,
  BUSINESS_VERIFICATION_URL,
  BUSINESS_VERIFY_HELP_URL,
  COMMENTER_NAMES_APP_REVIEW_URL,
  COMMENTER_NAMES_FEATURE,
  COMMENTER_NAMES_FEATURE_URL,
  COMMENTER_NAMES_REVIEW_USE_CASE,
  businessVerificationPhoneMyth,
  hiddenCommenterSummary,
} from "@/lib/integrations/facebook/commenter-names-access";
import { Copy, Loader2 } from "lucide-react";

export function FacebookCommenterNamesCard({
  hiddenCount,
  canWrite,
}: {
  hiddenCount: number;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [checking, setChecking] = useState(false);
  if (hiddenCount <= 0) return null;

  async function checkAgain() {
    setChecking(true);
    const result = await refreshFacebookCommentAuthors();
    setChecking(false);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    if (result.updated > 0) {
      toast.success(
        `Facebook returned ${result.updated} commenter name${result.updated === 1 ? "" : "s"}`
      );
      router.refresh();
      return;
    }
    toast.message(
      result.hidden
        ? `Still hidden: ${result.hidden}. Finish Business verification, then App Review for ${COMMENTER_NAMES_FEATURE}.`
        : "No hidden names left to refresh."
    );
  }

  async function copyText(label: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Could not copy. Select the text and copy it manually.");
    }
  }

  return (
    <Card className="border-amber-400/60 bg-amber-500/15">
      <CardContent className="space-y-3 py-4 text-sm">
        <p className="font-medium text-amber-100">{hiddenCommenterSummary(hiddenCount)}</p>
        <p className="text-muted-foreground">
          This is a Meta gate, not a CCC bug. Graph strips visitor names until the Business is
          verified and the app has Advanced Access to{" "}
          <a className="underline" href={COMMENTER_NAMES_FEATURE_URL} target="_blank" rel="noreferrer">
            {COMMENTER_NAMES_FEATURE}
          </a>
          . Until then, use <strong>Set name</strong> from what you see on the Facebook Page.
        </p>

        <div className="rounded-md border border-amber-400/40 bg-black/20 p-3 text-muted-foreground">
          <p className="font-medium text-amber-50">Phone on a government ID is not required</p>
          <p className="mt-1">{businessVerificationPhoneMyth()}</p>
          <p className="mt-2">
            Meta docs:{" "}
            <a className="underline" href={BUSINESS_DOCUMENTS_HELP_URL} target="_blank" rel="noreferrer">
              which documents to upload
            </a>
            {" · "}
            <a className="underline" href={BUSINESS_VERIFY_HELP_URL} target="_blank" rel="noreferrer">
              how to verify
            </a>
          </p>
        </div>

        <ol className="list-decimal space-y-2 pl-5 text-muted-foreground">
          <li>
            <strong>Business verification</strong> (not personal Meta Verified): open{" "}
            <a className="underline" href={BUSINESS_VERIFICATION_URL} target="_blank" rel="noreferrer">
              Security Center
            </a>
            . Upload <strong>CAC</strong> for the legal name, plus a{" "}
            <strong>business bank statement or utility bill</strong> (last ~3 months) with the{" "}
            <strong>same name and address</strong>. Confirm the connection with{" "}
            <strong>domain verification</strong> or domain email OTP if SMS/docs keep failing.
          </li>
          <li>
            App <strong>campaign commander center</strong> →{" "}
            <a className="underline" href={COMMENTER_NAMES_APP_REVIEW_URL} target="_blank" rel="noreferrer">
              Live
            </a>
            {" "}
            → App Review → Advanced Access for {COMMENTER_NAMES_FEATURE},{" "}
            <code>pages_read_user_content</code>, and <code>pages_read_engagement</code>.
          </li>
          <li>Paste the use case below, submit a screencast of Comments → Unknown commenter, then return here and Check again.</li>
        </ol>

        <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-md border bg-black/30 p-3 text-xs text-foreground">
          {COMMENTER_NAMES_REVIEW_USE_CASE}
        </pre>
        <details className="rounded-md border bg-black/20 p-3">
          <summary className="cursor-pointer font-medium text-amber-50">
            Full Nigeria verification playbook
          </summary>
          <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">
            {BUSINESS_VERIFICATION_PLAYBOOK}
          </pre>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => copyText("Verification playbook", BUSINESS_VERIFICATION_PLAYBOOK)}
          >
            <Copy className="h-3 w-3" /> Copy playbook
          </Button>
        </details>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => copyText("App Review text", COMMENTER_NAMES_REVIEW_USE_CASE)}
          >
            <Copy className="h-3 w-3" /> Copy App Review text
          </Button>
          {canWrite ? (
            <Button type="button" size="sm" onClick={checkAgain} disabled={checking}>
              {checking ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              Check again
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
