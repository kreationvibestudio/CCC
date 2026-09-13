"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { refreshFacebookCommentAuthors } from "@/lib/comments/actions";
import {
  COMMENTER_NAMES_APP_REVIEW_URL,
  COMMENTER_NAMES_FEATURE,
  COMMENTER_NAMES_FEATURE_URL,
  COMMENTER_NAMES_REVIEW_USE_CASE,
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
        ? `Still hidden: ${result.hidden}. Meta has not approved ${COMMENTER_NAMES_FEATURE} yet.`
        : "No hidden names left to refresh."
    );
  }

  async function copyUseCase() {
    try {
      await navigator.clipboard.writeText(COMMENTER_NAMES_REVIEW_USE_CASE);
      toast.success("App Review text copied");
    } catch {
      toast.error("Could not copy. Select the text and copy it manually.");
    }
  }

  return (
    <Card className="border-amber-400/60 bg-amber-500/15">
      <CardContent className="space-y-3 py-4 text-sm">
        <p className="font-medium text-amber-100">{hiddenCommenterSummary(hiddenCount)}</p>
        <p className="text-muted-foreground">
          Until Meta approves that feature, use <strong>Set name</strong> on a comment if you can
          see the person on the Facebook Page. After approval, click Check again — names fill in
          automatically.
        </p>
        <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
          <li>
            Open the{" "}
            <a className="underline" href={COMMENTER_NAMES_APP_REVIEW_URL} target="_blank" rel="noreferrer">
              Meta app
            </a>{" "}
            <strong>campaign commander center</strong>. Switch it to <strong>Live</strong> and finish{" "}
            <strong>Business verification</strong>.
          </li>
          <li>
            App Review → Permissions and features → request Advanced Access to{" "}
            <a className="underline" href={COMMENTER_NAMES_FEATURE_URL} target="_blank" rel="noreferrer">
              {COMMENTER_NAMES_FEATURE}
            </a>
            , plus <code>pages_read_user_content</code> and <code>pages_read_engagement</code>.
          </li>
          <li>Paste the use case below. After Meta approves, return here and Check again.</li>
        </ol>
        <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-md border bg-black/30 p-3 text-xs text-foreground">
          {COMMENTER_NAMES_REVIEW_USE_CASE}
        </pre>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={copyUseCase}>
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
