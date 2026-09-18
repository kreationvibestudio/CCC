/** Whole days remaining until `targetIso` (UTC date math). Past dates return 0. */
export function daysUntil(targetIso: string | null | undefined, now = Date.now()): number | null {
  if (!targetIso) return null;
  const target = new Date(targetIso).getTime();
  if (!Number.isFinite(target)) return null;
  const diff = target - now;
  if (diff <= 0) return 0;
  return Math.floor(diff / 86_400_000);
}

export function briefingGreeting(now = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}
