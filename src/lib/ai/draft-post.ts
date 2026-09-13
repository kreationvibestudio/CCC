import { openAiChatCompletion } from "./openai.ts";
import { talkingPointFor } from "../media/topics.ts";
import { fallbackDraftPost, type DraftPost } from "../media/draft-fallback.ts";

export type { DraftPost };
export { fallbackDraftPost };

const SYSTEM_PROMPT = `You write short Facebook posts for Hon Akhakon Anenih's campaign HQ in Edo State, Nigeria.

Rules:
- Return JSON only: {"title":"...","body":"...","talking_points":["..."]}
- Body under 280 characters. Facebook caption, not a speech.
- Answer the issue people actually raised. Do not invent policies, budgets, dates, project names, or promises.
- Stay warm, respectful, and specific. English only.
- No attacks on opponents. No slogans that dodge the complaint.`;

function parseDraft(text: string): DraftPost | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const json = JSON.parse(match[0]) as Record<string, unknown>;
    const title = typeof json.title === "string" ? json.title.trim() : "";
    const body = typeof json.body === "string" ? json.body.trim() : "";
    if (!title || !body) return null;
    const points = Array.isArray(json.talking_points)
      ? json.talking_points.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      : [];
    return {
      title: title.slice(0, 120),
      body: body.slice(0, 280),
      talking_points: points.slice(0, 5),
    };
  } catch {
    return null;
  }
}

export async function draftPostWithAI(topic: string, comments: string[]): Promise<DraftPost> {
  const sample = comments
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 8)
    .map((item, i) => `${i + 1}. ${item.slice(0, 220)}`)
    .join("\n");

  const ai = await openAiChatCompletion({
    temperature: 0.4,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Draft a Facebook post on this issue.

Issue: ${topic}
Talking point: ${talkingPointFor(topic)}
Recent comments on this topic:
${sample || "(none synced)"}`,
      },
    ],
  });

  if (ai.ok) {
    const parsed = parseDraft(ai.text);
    if (parsed) {
      if (parsed.talking_points.length === 0) {
        parsed.talking_points = [talkingPointFor(topic)];
      }
      return parsed;
    }
  }

  return fallbackDraftPost(topic, comments);
}
