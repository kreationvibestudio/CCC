import { getCurrentUser } from "@/lib/auth/session";
import { getSocialAccounts, getSocialPosts } from "@/lib/social/data";
import { SocialDashboard } from "@/components/social/social-dashboard";
import { getFacebookConnectionStatus } from "@/lib/social/facebook-connection";
import { isSocialDemoModeEnabled } from "@/lib/integrations/facebook/demo";
import { listWatchPosts, listWatchTargets } from "@/lib/social/watch-actions";

export default async function SocialPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  const user = await getCurrentUser();
  const tenantId = user!.profile.tenant_id;
  const query = searchParams ? await searchParams : {};

  const [accounts, posts, connection, watchTargets, watchPosts] = await Promise.all([
    getSocialAccounts(tenantId),
    getSocialPosts(tenantId),
    getFacebookConnectionStatus(tenantId),
    listWatchTargets(true).catch(() => []),
    listWatchPosts({ limit: 100 }).catch(() => []),
  ]);

  const liveConfigured = connection.configured;
  const demoMode = !liveConfigured && isSocialDemoModeEnabled();

  const liveAccounts = accounts.filter((a) => a.account_id !== "demo-hon-akhakon");
  const displayAccounts = liveAccounts.length ? liveAccounts : accounts;

  return (
    <SocialDashboard
      accounts={displayAccounts}
      posts={posts.filter((p) => {
        if (!liveConfigured) return true;
        return !String(p.platform_post_id ?? "").startsWith("demo_post_");
      })}
      facebookConfigured={liveConfigured || demoMode}
      demoMode={demoMode}
      connection={connection}
      watchTargets={watchTargets}
      watchPosts={watchPosts}
      defaultTab={query.tab === "watch" ? "watch" : "page"}
    />
  );
}
