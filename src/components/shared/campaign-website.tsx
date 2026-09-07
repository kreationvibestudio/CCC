"use client";

import { useAuth } from "@/components/providers/auth-provider";

/**
 * The campaign's own public site, from the `campaign_website` tenant setting.
 *
 * These prompts used to name one campaign's domain in the shared HQ UI, which
 * would tell every other workspace to publish its links on a stranger's site.
 * With nothing configured it degrades to neutral wording rather than a link.
 */
export function CampaignWebsite({ fallback = "your campaign website" }: { fallback?: string }) {
  const website = useAuth()?.workspace?.website ?? "";
  if (!website) return <span>{fallback}</span>;

  return (
    <a
      className="underline underline-offset-2"
      href={website}
      target="_blank"
      rel="noreferrer"
    >
      {website.replace(/^https?:\/\//i, "")}
    </a>
  );
}
