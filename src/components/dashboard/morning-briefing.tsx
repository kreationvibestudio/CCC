"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Megaphone, Radio, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LiveNumber } from "@/components/situation-room/situation-room-charts";
import { usePermissions } from "@/components/providers/auth-provider";
import { briefingGreeting, daysUntil } from "@/lib/dashboard/countdown";
import type { DashboardBriefing } from "@/lib/dashboard-data";

export function MorningBriefing({
  tenantName,
  electionDate,
  briefing,
}: {
  tenantName: string;
  electionDate: string | null;
  briefing: DashboardBriefing | null;
}) {
  const { can } = usePermissions();
  const [days, setDays] = useState(() => daysUntil(electionDate) ?? 0);
  const greeting = briefingGreeting();
  const huddle = (briefing?.huddleText ?? briefing?.mediaLine ?? briefing?.summary ?? "").trim();
  const huddleLine = huddle
    ? huddle.split("\n").map((line) => line.trim()).filter(Boolean)[0] ?? huddle
    : "Open Media for today’s comment heat and the next post.";

  useEffect(() => {
    const tick = () => setDays(daysUntil(electionDate) ?? 0);
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, [electionDate]);

  const ctas = [
    can("social.view")
      ? { href: "/media", label: "Open Media", icon: Megaphone }
      : null,
    can("situation_room.view")
      ? { href: "/situation-room", label: "Situation Room", icon: Radio }
      : null,
    can("training.view")
      ? { href: "/training", label: "Send reminders", icon: GraduationCap }
      : null,
  ].filter(Boolean) as Array<{ href: string; label: string; icon: typeof Megaphone }>;

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/15 via-card to-card p-5 sm:p-7"
      aria-label="Morning campaign briefing"
    >
      <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-emerald-400/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 left-1/3 h-40 w-40 rounded-full bg-amber-400/10 blur-3xl" />

      <div className="relative flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          Live desk
        </span>
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
          {greeting} · campaign briefing
        </p>
      </div>

      <h2 className="relative mt-4 text-3xl font-bold tracking-tight sm:text-4xl">{tenantName}</h2>

      {electionDate ? (
        <p className="relative mt-3 text-lg text-foreground/90 sm:text-xl">
          {days === 0 ? (
            <>Election day is here.</>
          ) : (
            <>
              <LiveNumber value={days} /> day{days === 1 ? "" : "s"} to election
            </>
          )}
        </p>
      ) : (
        <p className="relative mt-3 text-lg text-muted-foreground sm:text-xl">
          Set the election date in Admin to light the countdown.
        </p>
      )}

      <p className="relative mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
        {huddleLine}
      </p>

      {ctas.length > 0 ? (
        <div className="relative mt-6 flex flex-wrap gap-2">
          {ctas.map(({ href, label, icon: Icon }, index) => (
            <Button
              key={href}
              asChild
              variant={index === 0 ? "default" : "outline"}
              size="sm"
              className={index === 0 ? "bg-emerald-600 hover:bg-emerald-600/90" : undefined}
            >
              <Link href={href}>
                <Icon className="h-3.5 w-3.5" />
                {label}
              </Link>
            </Button>
          ))}
        </div>
      ) : null}
    </motion.section>
  );
}
