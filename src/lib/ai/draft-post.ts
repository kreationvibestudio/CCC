import { openAiChatCompletion } from "./openai.ts";
import { talkingPointFor } from "../media/topics.ts";
import { angleFor, isMediaTone, type MediaTone } from "../media/tones.ts";
import { fallbackDraftPost, type DraftPost } from "../media/draft-fallback.ts";

export type { DraftPost };
export { fallbackDraftPost };

const SYSTEM_PROMPT = `You write campaign media for Hon Akhakon Anenih's HQ in Edo State, Nigeria.

Return JSON only:
{"title":"...","body":"...","article":"...","talking_points":["..."]}

- body: Facebook caption. Listen tone: under 280 characters. Agenda or shake: up to 700 characters. Punchy, not a speech.
- article: 120–180 words. A short thought-provoking piece the team can paste into a blog, WhatsApp forward, or radio note.
- talking_points: 2–4 short production notes for HQ, not published copy.

Rules:
- Do not invent policies, budgets, dates, project names, promises, or opponent scandals.
- Do not accuse APC, NDC, or any person of a crime. No ethnic attacks. No insults.
- Hard questions are allowed: who covered the ground, who has a ward-level plan, why the comments are still arguing.
- English only. Name Hon Akhakon Anenih as the candidate setting the question when the tone is agenda or shake.
- Stay specific to Edo. No empty slogans.`;

function parseDraft(text: string, tone: MediaTone): DraftPost | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const json = JSON.parse(match[0]) as Record<string, unknown>;
    const title = typeof json.title === "string" ? json.title.trim() : "";
    const body = typeof json.body === "string" ? json.body.trim() : "";
    const article = typeof json.article === "string" ? json.article.trim() : "";
    if (!title || !body) return null;
    const points = Array.isArray(json.talking_points)
      ? json.talking_points.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      : [];
    const bodyMax = tone === "listen" ? 280 : 720;
    return {
      title: title.slice(0, 120),
      body: body.slice(0, bodyMax),
      article: article.slice(0, 2200),
      tone,
      talking_points: points.slice(0, 5),
    };
  } catch {
    return null;
  }
}

function toneBrief(tone: MediaTone): string {
  if (tone === "shake") {
    return `Tone: shake the race. Thought-provoking contrast. Ask APC and the other tickets hard questions. Catch up by setting the question, not by inventing dirt.`;
  }
  if (tone === "agenda") {
    return `Tone: set the agenda. HQ chooses the question of the week. Do not merely echo the inbox. Be thought-provoking.`;
  }
  return `Tone: listen. Answer the issue people actually raised. Warm, respectful, specific.`;
}

export async function draftPostWithAI(
  topic: string,
  comments: string[],
  tone: MediaTone = "listen"
): Promise<DraftPost> {
  const chosen = isMediaTone(tone) ? tone : "listen";
  const sample = comments
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 8)
    .map((item, i) => `${i + 1}. ${item.slice(0, 220)}`)
    .join("\n");

  const ai = await openAiChatCompletion({
    temperature: chosen === "listen" ? 0.4 : 0.7,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Draft a Facebook caption and a short article.

Issue: ${topic}
${toneBrief(chosen)}
Editorial angle: ${angleFor(topic, chosen)}
Listen talking point (facts only): ${talkingPointFor(topic)}
Recent comments on this topic (context, not a script):
${sample || "(none synced)"}`,
      },
    ],
  });

  if (ai.ok) {
    const parsed = parseDraft(ai.text, chosen);
    if (parsed) {
      if (parsed.talking_points.length === 0) {
        parsed.talking_points = [angleFor(topic, chosen)];
      }
      if (!parsed.article) {
        parsed.article = fallbackDraftPost(topic, comments, chosen).article;
      }
      return parsed;
    }
  }

  return fallbackDraftPost(topic, comments, chosen);
}
