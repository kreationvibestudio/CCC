import { requirePlatformOperator } from "@/lib/auth/session";
import { listWorkspaces } from "@/lib/platform/actions";
import { PlatformConsole } from "@/components/platform/platform-console";
import { FEATURED_PARTIES } from "@/lib/elections/parties";
import { CAMPAIGN_TENANT_ID } from "@/lib/campaign";

export const dynamic = "force-dynamic";

export default async function PlatformPage() {
  await requirePlatformOperator();
  const workspaces = await listWorkspaces();
  return (
    <PlatformConsole
      workspaces={workspaces}
      parties={FEATURED_PARTIES}
      defaultCloneSource={CAMPAIGN_TENANT_ID}
    />
  );
}
