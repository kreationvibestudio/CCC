import { getCurrentUser } from "@/lib/auth/session";
import { getMediaCommandData } from "@/lib/media/data";
import { getFacebookConnectionStatus } from "@/lib/social/facebook-connection";
import { MediaCommand } from "@/components/media/media-command";
import { canWriteRecords, hasPermission } from "@/types/auth";

export default async function MediaCommandPage() {
  const user = await getCurrentUser();
  const tenantId = user!.profile.tenant_id;
  const [data, facebook] = await Promise.all([
    getMediaCommandData(tenantId),
    getFacebookConnectionStatus(tenantId),
  ]);
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
      facebook={{
        pageId: facebook.pageId,
        configured: facebook.configured,
        lastError: facebook.lastError,
      }}
    />
  );
}
