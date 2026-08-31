import { getCurrentUser } from "@/lib/auth/session";
import { getSocialAccounts, getSocialPosts } from "@/lib/social/data";
import { SocialDashboard } from "@/components/social/social-dashboard";
import { getFacebookConnectionStatus } from "@/lib/social/facebook-connection";
import { isSocialDemoModeEnabled } from "@/lib/integrations/facebook/demo";

export default async function SocialPage() {
  const user = await getCurrentUser();
  const tenantId = user!.profile.tenant_id;

  const [accounts, posts, connection] = await Promise.all([
    getSocialAccounts(tenantId),
    getSocialPosts(tenantId),
    getFacebookConnectionStatus(tenantId),
  ]);

  const liveConfigured = connection.configured;
  const demoMode = !liveConfigured && isSocialDemoModeEnabled();

  // Prefer live (non-demo) Facebook account for the stats card
  const liveAccounts = accounts.filter((a) => a.account_id !== "demo-hon-akhakon");
  const displayAccounts = liveAccounts.length ? liveAccounts : accounts;

  return (
    <SocialDashboard
      accounts={displayAccounts}
      posts={posts.filter((p) => {
        // If we have a live account, hide demo-only posts when live is configured
        if (!liveConfigured) return true;
        return !String(p.platform_post_id ?? "").startsWith("demo_post_");
      })}
      facebookConfigured={liveConfigured || demoMode}
      demoMode={demoMode}
      connection={connection}
    />
  );
}
