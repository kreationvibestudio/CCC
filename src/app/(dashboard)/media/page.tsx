import { getCurrentUser } from "@/lib/auth/session";
import { getMediaCommandData } from "@/lib/media/data";
import { MediaCommand } from "@/components/media/media-command";
import { canWriteRecords, hasPermission } from "@/types/auth";

export default async function MediaCommandPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await getCurrentUser();
  const tenantId = user!.profile.tenant_id;
  const { tab } = await searchParams;
  const data = await getMediaCommandData(tenantId);
  const canManage = Boolean(
    user && canWriteRecords(user.role) && hasPermission(user.role, "social.manage")
  );
  const canReply = Boolean(
    user && canWriteRecords(user.role) && hasPermission(user.role, "comments.reply")
  );

  return (
    <MediaCommand
      data={data}
      canManage={canManage}
      canReply={canReply}
      initialTab={tab}
    />
  );
}
