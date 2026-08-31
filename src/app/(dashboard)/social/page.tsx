import { getCurrentUser } from "@/lib/auth/session";
import { getSocialAccounts, getSocialPosts } from "@/lib/social/data";
import { SocialDashboard } from "@/components/social/social-dashboard";
import { isSocialDemoModeEnabled } from "@/lib/integrations/facebook/demo";

export default async function SocialPage() {
  const user = await getCurrentUser();
  const tenantId = user!.profile.tenant_id;

  const [accounts, posts] = await Promise.all([
    getSocialAccounts(tenantId),
    getSocialPosts(tenantId),
  ]);

  const liveFacebookConfigured = Boolean(
    process.env.FACEBOOK_PAGE_ID &&
      process.env.FACEBOOK_PAGE_ID.trim() !== "[SENSITIVE]" &&
      !/^your[_-]/i.test(process.env.FACEBOOK_PAGE_ID.trim()) &&
      ((process.env.FACEBOOK_PAGE_ACCESS_TOKEN?.trim().length ?? 0) >= 40 ||
        (process.env.FACEBOOK_USER_ACCESS_TOKEN?.trim().length ?? 0) >= 40) &&
      process.env.FACEBOOK_PAGE_ACCESS_TOKEN?.trim() !== "[SENSITIVE]" &&
      process.env.FACEBOOK_USER_ACCESS_TOKEN?.trim() !== "[SENSITIVE]"
  );
  const demoMode = isSocialDemoModeEnabled();
  const facebookConfigured = liveFacebookConfigured || demoMode;

  return (
    <SocialDashboard
      accounts={accounts}
      posts={posts}
      facebookConfigured={facebookConfigured}
      demoMode={demoMode && !liveFacebookConfigured}
    />
  );
}
