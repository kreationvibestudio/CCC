import { getCurrentUser } from "@/lib/auth/session";
import { getMediaCommandData } from "@/lib/media/data";
import { getFacebookConnectionStatus } from "@/lib/social/facebook-connection";
import { MediaCommand } from "@/components/media/media-command";
import { canWriteRecords, hasPermission } from "@/types/auth";

export default async function MediaCommandPage() {
  const user = await getCurrentUser();
  const tenantId = user!.profile.tenant_id;
  const data = await getMediaCommandData(tenantId);
  let facebook = {
    pageId: "",
    configured: false,
    lastError: null as string | null,
  };
  try {
    facebook = await getFacebookConnectionStatus(tenantId);
  } catch {
    facebook = {
      pageId: "",
      configured: false,
      lastError: "Could not load Facebook connection status.",
    };
  }
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
