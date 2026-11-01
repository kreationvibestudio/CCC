"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AgentGeoCascade } from "@/components/agents/agent-geo-cascade";
import { NinVerifyField } from "@/components/agents/nin-verify-field";
import {
  createAgentRegistration,
  getAgentNinMigrationSql,
  getAgentsTableMigrationSql,
} from "@/lib/agents/registration";
import { getAgentIdentityMigrationSql } from "@/lib/agents/actions";

export function AgentRegistrationForm({
  needsAgentsMigration = false,
}: {
  needsAgentsMigration?: boolean;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement | null>(null);
  const [pending, startTransition] = useTransition();
  const [collationRole, setCollationRole] = useState<"none" | "ward" | "lga">("none");
  const [fullName, setFullName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [ninKey, setNinKey] = useState(0);
  const [showAgentsSql, setShowAgentsSql] = useState(needsAgentsMigration);
  const [showIdentitySql, setShowIdentitySql] = useState(false);
  const [showNinSql, setShowNinSql] = useState(false);

  async function copyAgentsSql() {
    const result = await getAgentsTableMigrationSql();
    if ("error" in result && result.error) {
      toast.error(result.error);
      return;
    }
    await navigator.clipboard.writeText(result.sql);
    toast.success("Agents table SQL copied. Paste in Supabase SQL editor, then Run.");
  }

  async function copyIdentitySql() {
    const result = await getAgentIdentityMigrationSql();
    if ("error" in result && result.error) {
      toast.error(result.error);
      return;
    }
    await navigator.clipboard.writeText(result.sql);
    toast.success("Identity-fields SQL copied. Paste in Supabase SQL editor, then Run.");
  }

  async function copyNinSql() {
    const result = await getAgentNinMigrationSql();
    if ("error" in result && result.error) {
      toast.error(result.error);
      return;
    }
    await navigator.clipboard.writeText(result.sql);
    toast.success("NIN columns SQL copied. Paste in Supabase SQL editor, then Run.");
  }

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const verificationRaw = String(formData.get("nin_verification_json") ?? "");
      let ninVerification: Record<string, unknown> | null = null;
      if (verificationRaw) {
        try {
          ninVerification = JSON.parse(verificationRaw) as Record<string, unknown>;
        } catch {
          toast.error("NIN verification data is invalid — verify again");
          return;
        }
      }
      const ninVerifiedAt = String(formData.get("nin_verified_at") ?? "").trim();

      const result = await createAgentRegistration({
        fullName: String(formData.get("full_name") ?? ""),
        membershipCardNumber: String(formData.get("membership_card_number") ?? ""),
        state: String(formData.get("state") ?? ""),
        lga: String(formData.get("lga") ?? ""),
        ward: String(formData.get("ward") ?? ""),
        puCode: String(formData.get("pu_code") ?? ""),
        pollingUnitId: String(formData.get("polling_unit_id") ?? ""),
        phone: String(formData.get("phone") ?? ""),
        votersCardNumber: String(formData.get("voters_card_number") ?? ""),
        collationRole: String(formData.get("collation_role") ?? "none"),
        email: String(formData.get("email") ?? ""),
        nin: String(formData.get("nin") ?? ""),
        dateOfBirth: String(formData.get("date_of_birth") ?? ""),
        ninVerifiedAt: ninVerifiedAt || undefined,
        ninVerification,
      });
      if (result.needsAgentsMigration) setShowAgentsSql(true);
      if (result.needsIdentityMigration) setShowIdentitySql(true);
      if (result.needsNinMigration) setShowNinSql(true);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      if (result.agentCode) {
        await navigator.clipboard.writeText(result.agentCode).catch(() => undefined);
        toast.success(`Registered · code ${result.agentCode} for ${result.puCode}. Copied.`);
      } else {
        toast.success(`Registered agent for ${result.puCode}`);
      }
      setCollationRole("none");
      setFullName("");
      setDateOfBirth("");
      setNinKey((k) => k + 1);
      formRef.current?.reset();
      if (result.id) router.push(`/agents/${result.id}`);
      else router.push("/agents");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {showAgentsSql ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <p className="font-medium">One SQL apply creates the Agents registration table</p>
          <p className="mt-1 text-muted-foreground">
            Cloud Supabase needs the <code>agents</code> table before paperwork records can be stored.
          </p>
          <div className="mt-3">
            <Button type="button" size="sm" onClick={() => void copyAgentsSql()}>
              Copy Agents table SQL
            </Button>
          </div>
        </div>
      ) : null}
      {showIdentitySql ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <p className="font-medium">Optional: unlock profile identity columns</p>
          <p className="mt-1 text-muted-foreground">
            Membership / PVC / NIN photo / collation also sync onto the system polling-agent profile.
          </p>
          <div className="mt-3">
            <Button type="button" size="sm" onClick={() => void copyIdentitySql()}>
              Copy identity-fields SQL
            </Button>
          </div>
        </div>
      ) : null}
      {showNinSql ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <p className="font-medium">NIN columns are missing on agents / profiles</p>
          <p className="mt-1 text-muted-foreground">
            Apply this once in Supabase so NIN verification results can be stored.
          </p>
          <div className="mt-3">
            <Button type="button" size="sm" onClick={() => void copyNinSql()}>
              Copy NIN SQL
            </Button>
          </div>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Agent details</CardTitle>
        </CardHeader>
        <CardContent>
          <form ref={formRef} action={handleSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="full_name">Name</Label>
              <Input
                id="full_name"
                name="full_name"
                required
                disabled={pending}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="membership_card_number">Membership card number (optional)</Label>
              <Input id="membership_card_number" name="membership_card_number" disabled={pending} />
            </div>

            <AgentGeoCascade disabled={pending} unassignedOnly />

            <div className="space-y-1">
              <Label htmlFor="phone">Phone number</Label>
              <Input id="phone" name="phone" required disabled={pending} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="voters_card_number">Voter&apos;s card number</Label>
              <Input id="voters_card_number" name="voters_card_number" required disabled={pending} />
            </div>

            <NinVerifyField
              key={ninKey}
              disabled={pending}
              fullName={fullName}
              dateOfBirth={dateOfBirth}
              onDateOfBirthChange={setDateOfBirth}
            />

            <fieldset className="space-y-2 sm:col-span-2">
              <legend className="text-sm font-medium">Collation agent role</legend>
              <p className="text-xs text-muted-foreground">
                Tick one if this person will also serve as a collation agent. Leave both unchecked for a
                regular polling-unit agent. The NIN photograph from Verify NIN is saved with the agent
                record — no separate passport upload.
              </p>
              <input type="hidden" name="collation_role" value={collationRole} />
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-input"
                  checked={collationRole === "ward"}
                  disabled={pending}
                  onChange={(e) => setCollationRole(e.target.checked ? "ward" : "none")}
                />
                <span>Ward collation agent</span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-input"
                  checked={collationRole === "lga"}
                  disabled={pending}
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
                disabled={pending}
                placeholder="Only if you still want email login"
              />
            </div>
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Save agent"}
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/agents">Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
