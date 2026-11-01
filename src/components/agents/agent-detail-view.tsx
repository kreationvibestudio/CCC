"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NinVerifyField } from "@/components/agents/nin-verify-field";
import { updateAgentRegistration, type AgentDetail } from "@/lib/agents/registration";
import { usePermissions } from "@/components/providers/auth-provider";
import { photoDataUrl } from "@/lib/integrations/verifyme/helpers";
import { ArrowLeft } from "lucide-react";

export function AgentDetailView({ agent }: { agent: AgentDetail }) {
  const router = useRouter();
  const { canCreate } = usePermissions();
  const [pending, startTransition] = useTransition();
  const [collationRole, setCollationRole] = useState<"none" | "ward" | "lga">(agent.collation_role);
  const [fullName, setFullName] = useState(agent.full_name);
  const [dateOfBirth, setDateOfBirth] = useState(agent.date_of_birth ?? "");

  function handleSave(formData: FormData) {
    startTransition(async () => {
      const verificationRaw = String(formData.get("nin_verification_json") ?? "").trim();
      let ninVerification: Record<string, unknown> | undefined;
      let ninVerifiedAt: string | undefined;
      if (verificationRaw) {
        try {
          ninVerification = JSON.parse(verificationRaw) as Record<string, unknown>;
        } catch {
          toast.error("NIN verification data is invalid — verify again");
          return;
        }
        ninVerifiedAt = String(formData.get("nin_verified_at") ?? "").trim() || undefined;
      }

      const result = await updateAgentRegistration(agent.id, {
        fullName: String(formData.get("full_name") ?? ""),
        membershipCardNumber: String(formData.get("membership_card_number") ?? ""),
        ward: String(formData.get("ward") ?? ""),
        phone: String(formData.get("phone") ?? ""),
        votersCardNumber: String(formData.get("voters_card_number") ?? ""),
        collationRole: String(formData.get("collation_role") ?? "none"),
        email: String(formData.get("email") ?? ""),
        nin: String(formData.get("nin") ?? ""),
        dateOfBirth: String(formData.get("date_of_birth") ?? ""),
        // Only overwrite NIN verification when Verify NIN produced a fresh payload.
        ...(ninVerification
          ? { ninVerifiedAt: ninVerifiedAt ?? null, ninVerification }
          : {}),
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Agent updated");
      router.refresh();
    });
  }

  const geoLabel = [
    agent.state || agent.pu_state,
    agent.lga || agent.pu_lga,
    agent.ward || agent.pu_ward,
  ]
    .filter(Boolean)
    .join(" · ");

  const ninPhoto =
    typeof agent.nin_verification?.photo === "string"
      ? photoDataUrl(agent.nin_verification.photo)
      : null;
  const photoUrl = agent.passport_photo_url || ninPhoto;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title={agent.full_name} description="Registered agent linked to a polling unit and field login">
        <Button variant="outline" asChild>
          <Link href="/agents">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Agents
          </Link>
        </Button>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Linked unit &amp; login</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex flex-wrap gap-4">
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoUrl}
                alt=""
                className="h-28 w-24 rounded object-cover border border-border"
              />
            ) : (
              <div className="flex h-28 w-24 items-center justify-center rounded border border-dashed border-border text-xs text-muted-foreground">
                No photo
              </div>
            )}
            <div className="min-w-0 space-y-2">
              <p>
                <span className="text-muted-foreground">Polling unit · </span>
                <span className="font-medium">
                  {agent.pu_code}
                  {agent.pu_name ? ` — ${agent.pu_name}` : ""}
                </span>
              </p>
              <p>
                <span className="text-muted-foreground">Geography · </span>
                {geoLabel || "—"}
              </p>
              <p className="flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground">Agent code · </span>
                <span className="font-mono tracking-wide">{agent.agent_code || "No code yet"}</span>
                {agent.agent_code ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      void navigator.clipboard
                        .writeText(agent.agent_code!)
                        .then(() => toast.success("Copied"))
                    }
                  >
                    Copy
                  </Button>
                ) : null}
              </p>
              {agent.nin_verified_at ? (
                <Badge variant="secondary">NIN verified</Badge>
              ) : (
                <Badge variant="outline">NIN not verified</Badge>
              )}
              {agent.collation_label ? <Badge variant="secondary">{agent.collation_label}</Badge> : null}
            </div>
          </div>
          <Button type="button" size="sm" variant="ghost" asChild>
            <Link href="/polling-units/agents">Open PU Agents (codes &amp; check-ins)</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Registration details</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={handleSave} className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="full_name">Name</Label>
              <Input
                id="full_name"
                name="full_name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                disabled={pending || !canCreate}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="membership_card_number">Membership card number (optional)</Label>
              <Input
                id="membership_card_number"
                name="membership_card_number"
                defaultValue={agent.membership_card_number ?? ""}
                disabled={pending || !canCreate}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ward">Ward</Label>
              <Input
                id="ward"
                name="ward"
                defaultValue={agent.ward ?? agent.pu_ward ?? ""}
                disabled={pending || !canCreate}
              />
            </div>
            <div className="space-y-1">
              <Label>Polling unit</Label>
              <Input value={agent.pu_code} disabled />
            </div>
            <div className="space-y-1">
              <Label htmlFor="phone">Phone number</Label>
              <Input
                id="phone"
                name="phone"
                defaultValue={agent.phone}
                required
                disabled={pending || !canCreate}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="voters_card_number">Voter&apos;s card number</Label>
              <Input
                id="voters_card_number"
                name="voters_card_number"
                defaultValue={agent.voters_card_number ?? ""}
                required
                disabled={pending || !canCreate}
              />
            </div>

            <NinVerifyField
              disabled={pending || !canCreate}
              fullName={fullName}
              dateOfBirth={dateOfBirth}
              onDateOfBirthChange={setDateOfBirth}
              initialNin={agent.nin ?? ""}
              initialVerifiedAt={agent.nin_verified_at}
              initialVerification={agent.nin_verification}
              initialPhotoUrl={photoUrl}
            />

            <fieldset className="space-y-2 sm:col-span-2">
              <legend className="text-sm font-medium">Collation agent role</legend>
              <p className="text-xs text-muted-foreground">
                The NIN photograph is saved with this agent — no separate passport upload.
              </p>
              <input type="hidden" name="collation_role" value={collationRole} />
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-input"
                  checked={collationRole === "ward"}
                  disabled={pending || !canCreate}
                  onChange={(e) => setCollationRole(e.target.checked ? "ward" : "none")}
                />
                <span>Ward collation agent</span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-input"
                  checked={collationRole === "lga"}
                  disabled={pending || !canCreate}
                  onChange={(e) => setCollationRole(e.target.checked ? "lga" : "none")}
                />
                <span>LGA collation agent</span>
              </label>
            </fieldset>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="email">Email (optional)</Label>
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue={agent.email && !agent.email.endsWith("@ccc.agent") ? agent.email : ""}
                disabled={pending || !canCreate}
              />
            </div>
            {canCreate ? (
              <div className="sm:col-span-2">
                <Button type="submit" disabled={pending}>
                  {pending ? "Saving…" : "Save changes"}
                </Button>
              </div>
            ) : null}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
