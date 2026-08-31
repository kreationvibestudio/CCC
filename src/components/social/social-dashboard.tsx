import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, StatCard, EmptyState } from "@/components/shared/page-shell";
import { FacebookSyncButton } from "@/components/social/facebook-sync-button";
import { FacebookConnectForm } from "@/components/social/facebook-connect-form";
import { formatDate, formatNumber } from "@/lib/utils";
import { Facebook, Heart, MessageSquare, Share2 } from "lucide-react";

interface SocialAccount {
  id: string;
  platform: string;
  account_name: string;
  account_id?: string;
  is_connected: boolean;
  followers: number;
  last_synced_at?: string;
}

interface SocialPost {
  id: string;
  platform: string;
  platform_post_id: string;
  content?: string;
  media_url?: string;
  likes: number;
  shares: number;
  comments_count: number;
  engagement_rate: number;
  posted_at?: string;
}

type ConnectionStatus = {
  pageId: string;
  configured: boolean;
  hasPageToken: boolean;
  hasUserToken: boolean;
  accountName: string | null;
  followers: number | null;
  lastSyncedAt: string | null;
  lastLiveSyncAt: string | null;
  lastError: string | null;
  stale: boolean;
  staleHours: number | null;
};

export function SocialDashboard({
  accounts,
  posts,
  facebookConfigured,
  demoMode = false,
  connection,
}: {
  accounts: SocialAccount[];
  posts: SocialPost[];
  facebookConfigured: boolean;
  demoMode?: boolean;
  connection: ConnectionStatus;
}) {
  const facebook = accounts.find((a) => a.platform === "facebook");
  const facebookPosts = posts.filter((p) => p.platform === "facebook");
  const lastSyncLabel = connection.lastLiveSyncAt || facebook?.last_synced_at || connection.lastSyncedAt;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Social Media Command Center"
        description="Connect and monitor your campaign's social platforms"
      >
        <div className="flex flex-wrap gap-2">
          <FacebookConnectForm
            defaultPageId={connection.pageId || "671649942702174"}
            configured={connection.configured}
          />
          <FacebookSyncButton />
        </div>
      </PageHeader>

      {connection.stale && connection.configured && (
        <Card className="border-amber-500/40 bg-amber-500/10">
          <CardContent className="space-y-2 py-4 text-sm">
            <p className="font-medium text-amber-100">
              Live Facebook sync is stale
              {connection.staleHours != null ? ` (${connection.staleHours}h since last sync)` : ""}.
            </p>
            <p className="text-muted-foreground">
              Last live sync:{" "}
              {lastSyncLabel ? formatDate(lastSyncLabel) : "never"}. Click{" "}
              <strong>Sync Facebook Now</strong>. If it fails, your page token likely expired — use{" "}
              <strong>Update Facebook token</strong> and paste a new never-expiring page token.
            </p>
            {connection.lastError ? (
              <p className="rounded-md border border-amber-500/30 bg-black/20 p-2 text-xs text-amber-100/90 whitespace-pre-wrap">
                {connection.lastError}
              </p>
            ) : null}
          </CardContent>
        </Card>
      )}

      {!connection.configured && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="py-4 text-sm">
            Live Facebook is not connected. Use <strong>Connect Facebook</strong> above to paste your
            page ID and page access token. Until then, demo sample posts can still load with{" "}
            <strong>Sync Facebook Now</strong>.
          </CardContent>
        </Card>
      )}

      {demoMode && (
        <Card className="border-sky-500/30 bg-sky-500/5">
          <CardContent className="py-4 text-sm">
            Showing <strong>demo</strong> posts because no Meta page token is saved yet. Connect
            Facebook above to pull the real Hon Akhakon Annenih page.
          </CardContent>
        </Card>
      )}

      {connection.configured && !connection.stale && !demoMode && (
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="py-4 text-sm">
            Facebook is connected
            {connection.accountName ? ` (${connection.accountName})` : ""}. Click{" "}
            <strong>Sync Facebook Now</strong> to refresh posts. Daily cron also runs at 06:00 UTC.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Facebook Followers"
          value={facebook?.is_connected ? formatNumber(facebook.followers) : "—"}
          icon={Facebook}
          change={lastSyncLabel ? `Last synced ${formatDate(lastSyncLabel)}` : "Not synced yet"}
        />
        <StatCard title="Posts Loaded" value={facebookPosts.length} icon={MessageSquare} />
        <StatCard
          title="Total Likes"
          value={formatNumber(facebookPosts.reduce((s, p) => s + (p.likes ?? 0), 0))}
          icon={Heart}
        />
        <StatCard
          title="Total Shares"
          value={formatNumber(facebookPosts.reduce((s, p) => s + (p.shares ?? 0), 0))}
          icon={Share2}
        />
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold">Connected Accounts</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => (
            <Card key={account.id}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-base">
                  <span className="capitalize">{account.platform}</span>
                  <Badge variant={account.is_connected ? "success" : "secondary"}>
                    {account.is_connected ? "Connected" : "Not connected"}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <p className="font-medium text-foreground">{account.account_name}</p>
                <p>{formatNumber(account.followers)} followers</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold">Recent Facebook Posts</h2>
        {facebookPosts.length === 0 ? (
          <EmptyState
            title="No posts yet"
            description="Connect Facebook and click Sync Facebook Now to import posts from your page."
            action={<FacebookSyncButton />}
          />
        ) : (
          <div className="space-y-4">
            {facebookPosts.map((post) => (
              <Card key={post.id}>
                <CardContent className="pt-4">
                  <div className="flex gap-4">
                    {post.media_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={post.media_url}
                        alt=""
                        className="h-20 w-20 shrink-0 rounded-lg object-cover"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-3 text-sm whitespace-pre-wrap">
                        {post.content || "(No text)"}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span>{post.posted_at ? formatDate(post.posted_at) : ""}</span>
                        <span>{post.likes} likes</span>
                        <span>{post.comments_count} comments</span>
                        <span>{post.shares} shares</span>
                        <span>{post.engagement_rate}% engagement</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
