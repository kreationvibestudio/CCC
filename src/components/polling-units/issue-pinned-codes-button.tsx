"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { issueMissingAgentCodes, provisionPinnedPollingUnits } from "@/lib/agents/actions";
import { AGENT_LOGIN_RADIUS_FT } from "@/lib/agent/geo";

type IssuedCode = { name: string; code: string; puCode: string };

export function IssuePinnedCodesButton({
  label = "Issue codes for pinned units",
  variant = "default",
  onIssued,
}: {
  label?: string;
  variant?: "default" | "secondary" | "outline";
  onIssued?: (codes: IssuedCode[]) => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function run() {
    if (
      !window.confirm(
        `Create a Field Agent login and 8-character code for every polling unit that has a map pin and no agent yet?\n\nThe agent must be within ${AGENT_LOGIN_RADIUS_FT} ft of that pin to sign in. Units without a pin are skipped.`
      )
    ) {
      return;
    }
    start(async () => {
      let created = 0;
      let missingPin = 0;
      const collected: IssuedCode[] = [];
      for (let i = 0; i < 400; i += 1) {
        const result = await provisionPinnedPollingUnits({ limit: 15 });
        if (result.error) {
          toast.error(result.error);
          return;
        }
        created += result.created;
        missingPin = result.missingPin;
        if (result.codes?.length) collected.push(...result.codes);
        if (result.created === 0 || result.remaining === 0) break;
      }
      if (collected.length) onIssued?.(collected);
      toast.success(
        created
          ? `Issued codes for ${created} polling unit${created === 1 ? "" : "s"}`
          : "No pinned unit was waiting for a code"
      );
      if (missingPin) {
        toast.warning(
          `${missingPin} unit${missingPin === 1 ? "" : "s"} have no map pin. Apply INEC GPS before those agents can check in.`
        );
      }
      router.refresh();
    });
  }

  return (
    <Button type="button" variant={variant} disabled={pending} onClick={run}>
      {pending ? "Issuing codes…" : label}
    </Button>
  );
}

export function FillMissingCodesButton({
  onIssued,
}: {
  onIssued?: (codes: IssuedCode[]) => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function run() {
    start(async () => {
      const result = await issueMissingAgentCodes();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      if (result.codes?.length) onIssued?.(result.codes);
      toast.success(
        result.issued
          ? `Issued ${result.issued} missing code${result.issued === 1 ? "" : "s"}`
          : "Every assigned unit already has a code"
      );
      router.refresh();
    });
  }

  return (
    <Button type="button" variant="outline" disabled={pending} onClick={run}>
      {pending ? "Filling…" : "Fill missing codes"}
    </Button>
  );
}

export function IssueCodesCallout({
  onIssued,
}: {
  onIssued?: (codes: IssuedCode[]) => void;
}) {
  return (
    <Card className="border-primary/50 bg-primary/5">
      <CardContent className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-base font-semibold">Issue codes for pinned units</p>
          <p className="text-sm text-muted-foreground">
            Create a Field Agent login and 8-character code for every polling unit that already
            has a map pin. Agents must be within {AGENT_LOGIN_RADIUS_FT} ft of that pin to sign in.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <IssuePinnedCodesButton onIssued={onIssued} />
          <FillMissingCodesButton onIssued={onIssued} />
        </div>
      </CardContent>
    </Card>
  );
}
