"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ExternalLink, Flag, Eye, Plus, Link2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { usePermissions } from "@/components/providers/auth-provider";
import { formatDateTime } from "@/lib/utils";
import {
  archiveWatchTarget,
  captureFacebookWatchUrl,
  createWatchTarget,
  updateWatchPostStatus,
  type WatchPostRow,
  type WatchTargetRow,
} from "@/lib/social/watch-actions";

export function SocialWatchPanel({
  targets,
  posts,
}: {
  targets: WatchTargetRow[];
  posts: WatchPostRow[];
}) {
  const { canWrite } = usePermissions();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [targetFilter, setTargetFilter] = useState<string>("all");
  const [campaignOnly, setCampaignOnly] = useState(false);
  const [pasteUrl, setPasteUrl] = useState("");
  const [pasteTargetId, setPasteTargetId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [notes, setNotes] = useState("");

  const activeTargets = useMemo(
    () => targets.filter((t) => !t.archived_at),
    [targets]
  );

  const visiblePosts = useMemo(() => {
    return posts.filter((post) => {
      if (targetFilter !== "all" && post.target_id !== targetFilter) return false;
      if (campaignOnly && !(post.keyword_hits?.length)) return false;
      return true;
    });
  }, [posts, targetFilter, campaignOnly]);

  function refresh() {
    router.refresh();
  }

  function onAddTarget() {
    startTransition(async () => {
      const result = await createWatchTarget({
        displayName,
        facebookUsername: username,
        notes,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`Watching ${result.target?.display_name ?? displayName}`);
      setDisplayName("");
      setUsername("");
      setNotes("");
      refresh();
    });
  }

  function onCapture() {
    startTransition(async () => {
      const result = await captureFacebookWatchUrl({
        url: pasteUrl,
        targetId: pasteTargetId || null,
      });
      if (result.error) {
        toast.error(result.error, { duration: 10000 });
        return;
      }
      const hits = result.keywordHits?.length
        ? ` · campaign keywords: ${result.keywordHits.join(", ")}`
        : "";
      toast.success(`Captured ${result.authorName ?? "post"}${hits}`);
      setPasteUrl("");
      refresh();
    });
  }

  function onArchive(id: string, name: string) {
    startTransition(async () => {
      const result = await archiveWatchTarget(id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`Archived ${name}`);
      if (targetFilter === id) setTargetFilter("all");
      refresh();
    });
  }

  function onStatus(id: string, status: "new" | "reviewed" | "flagged") {
    startTransition(async () => {
      const result = await updateWatchPostStatus(id, status);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      refresh();
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Watch targets</CardTitle>
          <p className="text-xs text-muted-foreground">
            Add every Facebook handle you want to track. Click a name to filter the feed.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <button
            type="button"
            className={`w-full rounded-md border px-3 py-2 text-left text-sm ${
              targetFilter === "all" ? "border-primary bg-primary/5" : "border-border"
            }`}
            onClick={() => setTargetFilter("all")}
          >
            All targets ({activeTargets.length})
          </button>
          <ul className="max-h-72 space-y-1 overflow-y-auto">
            {activeTargets.map((t) => (
              <li key={t.id} className="flex items-start gap-1">
                <button
                  type="button"
                  className={`min-w-0 flex-1 rounded-md border px-3 py-2 text-left text-sm ${
                    targetFilter === t.id ? "border-primary bg-primary/5" : "border-border"
                  }`}
                  onClick={() => setTargetFilter(t.id)}
                >
                  <span className="block truncate font-medium">{t.display_name}</span>
                  <span className="block truncate text-xs text-muted-foreground">@{t.facebook_username}</span>
                </button>
                {canWrite ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    className="shrink-0 px-2"
                    onClick={() => onArchive(t.id, t.display_name)}
                    title="Archive"
                  >
                    ×
                  </Button>
                ) : null}
              </li>
            ))}
            {!activeTargets.length ? (
              <li className="text-xs text-muted-foreground">No handles yet — add the first below.</li>
            ) : null}
          </ul>

          {canWrite ? (
            <div className="space-y-2 border-t pt-3">
              <Label htmlFor="watch-name">Display name</Label>
              <Input
                id="watch-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Dr Charles Imorijie"
              />
              <Label htmlFor="watch-user">Facebook username or URL</Label>
              <Input
                id="watch-user"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="akhogba.armani"
              />
              <Label htmlFor="watch-notes">Notes (optional)</Label>
              <Input
                id="watch-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Constantly attacking the campaign"
              />
              <Button type="button" size="sm" disabled={pending || !displayName || !username} onClick={onAddTarget}>
                <Plus className="mr-1 h-4 w-4" />
                Add to watchlist
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card className="border-sky-500/30 bg-sky-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Paste Facebook post / share link</CardTitle>
            <p className="text-xs text-muted-foreground">
              Meta does not allow apps to auto-read personal timelines. When you see a post, paste the share
              link here — CCC captures the public title and text for the Watch feed.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {canWrite ? (
              <>
                <div className="space-y-1">
                  <Label htmlFor="watch-url">Post or share URL</Label>
                  <Input
                    id="watch-url"
                    value={pasteUrl}
                    onChange={(e) => setPasteUrl(e.target.value)}
                    placeholder="https://web.facebook.com/share/p/…"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="watch-attach">Attach to target (optional)</Label>
                  <NativeSelect
                    id="watch-attach"
                    value={pasteTargetId}
                    onChange={(e) => setPasteTargetId(e.target.value)}
                  >
                    <option value="">Auto-match from URL / create</option>
                    {activeTargets.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.display_name} (@{t.facebook_username})
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                <Button type="button" disabled={pending || !pasteUrl.trim()} onClick={onCapture}>
                  <Link2 className="mr-2 h-4 w-4" />
                  Capture into Watch feed
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Your role is view-only on Social Media.</p>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={campaignOnly ? "default" : "outline"}
            onClick={() => setCampaignOnly((v) => !v)}
          >
            Campaign-related only
          </Button>
          <span className="text-xs text-muted-foreground">
            Showing {visiblePosts.length} post{visiblePosts.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="space-y-3">
          {visiblePosts.map((post) => {
            const related = Array.isArray(post.social_watch_targets)
              ? post.social_watch_targets[0]
              : post.social_watch_targets;
            const targetName =
              related?.display_name || post.author_name || related?.facebook_username || "Unknown";
            return (
              <Card key={post.id}>
                <CardContent className="space-y-2 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{targetName}</p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(post.captured_at)}</p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="outline">{post.status}</Badge>
                      {(post.keyword_hits ?? []).map((hit) => (
                        <Badge key={hit} variant="secondary">
                          {hit}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  {post.title && post.title !== post.author_name ? (
                    <p className="text-sm font-medium">{post.title}</p>
                  ) : null}
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">{post.body || "No public text captured."}</p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button type="button" size="sm" variant="outline" asChild>
                      <a href={post.canonical_url || post.source_url} target="_blank" rel="noreferrer">
                        <ExternalLink className="mr-1 h-3.5 w-3.5" />
                        Open on Facebook
                      </a>
                    </Button>
                    {canWrite ? (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={pending}
                          onClick={() => onStatus(post.id, "reviewed")}
                        >
                          <Eye className="mr-1 h-3.5 w-3.5" />
                          Reviewed
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={pending}
                          onClick={() => onStatus(post.id, "flagged")}
                        >
                          <Flag className="mr-1 h-3.5 w-3.5" />
                          Flag
                        </Button>
                      </>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {!visiblePosts.length ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                No watched posts yet. Add handles on the left, then paste Facebook share links as they appear.
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
