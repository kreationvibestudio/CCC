"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveFacebookConnection } from "@/lib/social/facebook-connection";

export function FacebookConnectForm({
  defaultPageId = "671649942702174",
  configured,
}: {
  defaultPageId?: string;
  configured: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pageId, setPageId] = useState(defaultPageId);
  const [pageToken, setPageToken] = useState("");
  const [userToken, setUserToken] = useState("");
  const [open, setOpen] = useState(!configured);

  if (!open && configured) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        Update Facebook token
      </Button>
    );
  }

  function onSave() {
    startTransition(async () => {
      const result = await saveFacebookConnection({
        pageId,
        pageAccessToken: pageToken,
        userAccessToken: userToken || undefined,
      });
      if (result.error) {
        toast.error(result.error, { duration: 14000 });
        return;
      }
      toast.success(
        `Connected ${result.pageName} (${result.followers?.toLocaleString() ?? 0} followers) and synced live posts`
      );
      if (result.warning) toast.warning(result.warning, { duration: 8000 });
      setPageToken("");
      setUserToken("");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Card className="border-sky-500/30 bg-sky-500/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Connect Facebook (live sync)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          Paste the <strong>page access token</strong> from <code>GET /me/accounts</code> — not the user
          token shown after Generate Token. HQ stores it and syncs immediately.
        </p>
        <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
          <li>
            Open{" "}
            <a
              className="underline"
              href="https://developers.facebook.com/tools/explorer/"
              target="_blank"
              rel="noreferrer"
            >
              Graph API Explorer
            </a>
          </li>
          <li>
            Add permissions: <code>pages_show_list</code>, <code>pages_read_engagement</code>,{" "}
            <code>pages_read_user_content</code>, <code>pages_manage_engagement</code>
          </li>
          <li>
            Generate Token as a page admin, then run <code>GET /me/accounts</code> and copy the{" "}
            <code>access_token</code> for page ID {defaultPageId}
          </li>
          <li>
            Paste that page token below. Or paste only a user token in the optional field and leave page
            token empty — CCC resolves the page token via <code>/me/accounts</code>.
          </li>
        </ol>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="fb-page-id">Facebook Page ID</Label>
            <Input
              id="fb-page-id"
              value={pageId}
              onChange={(e) => setPageId(e.target.value)}
              placeholder="671649942702174"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="fb-page-token">Page access token</Label>
            <Input
              id="fb-page-token"
              type="password"
              value={pageToken}
              onChange={(e) => setPageToken(e.target.value)}
              placeholder="Paste page token (never shown again)"
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="fb-user-token">User access token (optional)</Label>
            <Input
              id="fb-user-token"
              type="password"
              value={userToken}
              onChange={(e) => setUserToken(e.target.value)}
              placeholder="Only if you do not have a page token yet"
              autoComplete="off"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={onSave} disabled={pending}>
            {pending ? "Connecting…" : "Save & sync now"}
          </Button>
          {configured ? (
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
