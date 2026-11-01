import { requirePlatformOperator } from "@/lib/auth/session";
import { listWorkspaces } from "@/lib/platform/actions";
import { PlatformConsole } from "@/components/platform/platform-console";
import { REGISTERED_PARTIES } from "@/lib/elections/parties";
import { CAMPAIGN_TENANT_ID } from "@/lib/campaign";
import { listAvailableLicenseKeys } from "@/lib/licensing/actions";
import { annualLicenseAmountNaira } from "@/lib/licensing/keys";

export const dynamic = "force-dynamic";

export default async function PlatformPage() {
  await requirePlatformOperator();
  const [workspaces, keysResult] = await Promise.all([
    listWorkspaces(),
    listAvailableLicenseKeys(30),
  ]);
  return (
    <PlatformConsole
      workspaces={workspaces}
      parties={REGISTERED_PARTIES}
      defaultCloneSource={CAMPAIGN_TENANT_ID}
      availableLicenseKeys={keysResult.keys ?? []}
      licenseAmountNaira={annualLicenseAmountNaira()}
    />
  );
}
