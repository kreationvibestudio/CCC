import type { Comment } from "@/types/database";

const TEMPLATES: Record<string, string> = {
  roads: "Thank you for raising the road infrastructure concern. Our campaign has a concrete plan to fix key roads across the constituency. We hear you and we are committed to delivering results.",
  employment: "Youth employment is a top priority for our campaign. We are proposing job creation programmes and skills training across Esan North East and Esan South East. Thank you for holding us accountable.",
  healthcare: "Access to quality healthcare matters deeply to us. Our manifesto includes plans to improve rural health centres and ensure every ward has adequate medical support.",
  security: "Security is fundamental. We are committed to working with community leaders and security agencies to keep our people safe.",
  default: "Thank you for your comment and for engaging with our campaign. We value every voice in our constituency and we remain committed to serving you with integrity.",
};

export async function suggestReply(comment: Pick<Comment, "content" | "issue_topic" | "sentiment" | "author_name">): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  const firstName = comment.author_name.split(" ")[0];

  if (apiKey) {
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.7,
          messages: [
            {
              role: "system",
              content: "You write professional, warm replies for Hon Akhakon Anenih's Nigerian political campaign Facebook page. Keep replies under 280 characters, respectful, and in English. Do not be overly political.",
            },
            {
              role: "user",
              content: `Reply to ${comment.author_name} who wrote: "${comment.content}"\nSentiment: ${comment.sentiment}\nTopic: ${comment.issue_topic}`,
            },
          ],
        }),
      });
      const json = await res.json();
      const text = json.choices?.[0]?.message?.content?.trim();
      if (text) return text;
    } catch {
      /* fallback */
    }
  }

  const topic = comment.issue_topic ?? "other";
  const base = TEMPLATES[topic] ?? TEMPLATES.default;
  return `${firstName}, ${base}`;
}
