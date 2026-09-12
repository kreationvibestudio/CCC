import type { Comment } from "@/types/database";
import { openAiChatCompletion } from "@/lib/ai/openai";
import { fallbackSuggestedReply } from "@/lib/comments/quick-answers";

type SuggestableComment = Pick<
  Comment,
  "content" | "issue_topic" | "sentiment" | "author_name"
> & {
  is_misinformation?: boolean | null;
};

const SYSTEM_PROMPT = `You write short Facebook replies for Hon Akhakon Anenih's campaign HQ in Edo State, Nigeria.

Rules:
- Read the comment carefully. Answer the actual question, complaint, praise, or request. Do not send a generic thank-you when a specific reply is possible.
- Stay warm, respectful, and professional. Write in English. Keep the reply under 280 characters.
- Do not invent policies, budgets, dates, project names, or promises the campaign has not stated.
- If they asked for a location, contact, or next step, acknowledge that and ask for the ward or community if you need it.
- Do not attack opponents or sound overly partisan.
- Address the person by first name when you have it.
- Return only the reply text.`;

export async function suggestReply(comment: SuggestableComment): Promise<string> {
  const firstName = comment.author_name.trim().split(/\s+/)[0] || "friend";

  const ai = await openAiChatCompletion({
    temperature: 0.4,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Write a reply that matches this specific comment.

Author: ${comment.author_name}
First name: ${firstName}
Comment:
"""
${comment.content}
"""
Sentiment: ${comment.sentiment ?? "unknown"}
Topic: ${comment.issue_topic ?? "unknown"}
Flagged as rumour/misinformation: ${comment.is_misinformation ? "yes" : "no"}`,
      },
    ],
  });
  if (ai.ok && ai.text.trim()) return ai.text.trim();

  return fallbackSuggestedReply(comment);
}
