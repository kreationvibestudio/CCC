import { randomInt } from "crypto";

/** Short, common words — easy to say over a phone call or WhatsApp. */
const WORDS = [
  "apple",
  "river",
  "mango",
  "house",
  "green",
  "sunny",
  "happy",
  "quiet",
  "market",
  "lagos",
  "benin",
  "edo",
  "peace",
  "hope",
  "unity",
  "vote",
  "team",
  "field",
  "ward",
  "pulse",
  "light",
  "amber",
  "coral",
  "olive",
  "cedar",
  "maple",
  "pearl",
  "storm",
  "breeze",
  "garden",
] as const;

/**
 * Temporary password for invited users.
 * Format: word-word-## (e.g. mango-river-47) — lowercase, no special characters.
 * Meets the 8-character minimum; users must change it at first sign-in.
 */
export function easyTempPassword(): string {
  const a = WORDS[randomInt(WORDS.length)]!;
  let b = WORDS[randomInt(WORDS.length)]!;
  if (b === a) {
    b = WORDS[(WORDS.indexOf(a) + 1) % WORDS.length]!;
  }
  // Digits 2–9 only — avoids 0/O and 1/l confusion when read aloud.
  const tens = 2 + randomInt(8); // 2–9
  const ones = 2 + randomInt(8); // 2–9
  const digits = tens * 10 + ones;
  return `${a}-${b}-${digits}`;
}
