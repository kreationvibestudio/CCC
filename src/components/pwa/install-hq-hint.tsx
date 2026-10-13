"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Smartphone } from "lucide-react";

function isStandaloneDisplay() {
  if (typeof window === "undefined") return false;
  const media = window.matchMedia("(display-mode: standalone)").matches;
  const ios =
    "standalone" in navigator &&
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return media || ios;
}

function isAndroid() {
  if (typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent);
}

/** Short tip for Fold / Android HQ users — hidden once installed as an app. */
export function InstallHqHint({
  compact = false,
  showAdminLink = true,
}: {
  compact?: boolean;
  showAdminLink?: boolean;
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(isAndroid() && !isStandaloneDisplay());
  }, []);

  if (!show) return null;

  return (
    <div
      className={
        compact
          ? "rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
          : "rounded-lg border border-border/60 bg-muted/40 px-3 py-3 text-sm text-muted-foreground"
      }
    >
      <p className="flex items-start gap-2">
        <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <span>
          <span className="font-medium text-foreground">Install CCC HQ</span>
          {" — "}
          Chrome menu → <span className="text-foreground">Install app</span> / Add to Home screen for a
          full-screen war room (no browser bar). On a Fold, unfold for Situation Room and tables.{" "}
          {showAdminLink ? (
            <>
              Sideload APK notes live under{" "}
              <Link href="/admin" className="text-primary underline-offset-2 hover:underline">
                Admin
              </Link>
              .{" "}
            </>
          ) : (
            <>Use the CCC HQ APK when you have it, or Install app from Chrome. </>
          )}
          Field Agents use the separate <span className="text-foreground">CCC Agent</span> app — not this
          HQ install.
        </span>
      </p>
    </div>
  );
}
