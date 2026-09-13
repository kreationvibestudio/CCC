import type { Comment } from "@/types/database";

export interface QuickAnswer {
  id: string;
  label: string;
  body: string;
  topics?: Array<NonNullable<Comment["issue_topic"]>>;
}

/** Canned HQ replies for common Facebook comments. Staff can insert one, then edit. */
export const QUICK_ANSWERS: QuickAnswer[] = [
  {
    id: "thank-you",
    label: "Thank you",
    body: "Thank you, {name}. We appreciate you taking the time to write, and we value your voice in this campaign.",
  },
  {
    id: "look-into-it",
    label: "We'll look into it",
    body: "{name}, thank you for raising this. We have noted your concern and our team will look into it. Please share the ward or community if you can so we can follow up properly.",
  },
  {
    id: "roads",
    label: "Roads",
    body: "{name}, we hear you on the roads. Fixing key roads across Esan North East and Esan South East is a priority, and we are committed to delivering results.",
    topics: ["roads", "infrastructure"],
  },
  {
    id: "jobs",
    label: "Jobs and youth",
    body: "{name}, youth employment is a top priority. We are working on job creation and skills training so our young people can build a future here at home.",
    topics: ["employment", "youth", "economy"],
  },
  {
    id: "healthcare",
    label: "Healthcare",
    body: "{name}, access to quality healthcare matters deeply to us. We are committed to strengthening rural health centres so every ward gets the support it needs.",
    topics: ["healthcare"],
  },
  {
    id: "security",
    label: "Security",
    body: "{name}, security is fundamental. We will keep working with community leaders and security agencies to keep our people safe.",
    topics: ["security"],
  },
  {
    id: "education",
    label: "Education",
    body: "{name}, education is the foundation. We are committed to supporting schools and young people who want to learn and lead.",
    topics: ["education"],
  },
  {
    id: "power-water",
    label: "Power and water",
    body: "{name}, reliable power and water are basic. We hear this concern and it is part of our constituency development agenda.",
    topics: ["electricity", "water"],
  },
  {
    id: "support",
    label: "Thank you for the support",
    body: "Thank you for your support, {name}. Together we will keep building a campaign that serves the people of Edo with integrity.",
  },
  {
    id: "more-details",
    label: "Ask for details",
    body: "Thank you, {name}. To help us follow up properly, please share the ward or community and a bit more detail about what you are seeing.",
  },
  {
    id: "volunteer",
    label: "Invite to volunteer",
    body: "{name}, we would be glad to have you with us. Please share your ward and a phone number, or sign up as a volunteer so our team can reach you.",
  },
  {
    id: "respectful",
    label: "Keep it respectful",
    body: "Thank you for writing, {name}. We want this conversation to stay factual and respectful. If you have a specific concern, we are happy to address it with the facts.",
  },
];

export function firstNameFromAuthor(authorName: string): string {
  return authorName.trim().split(/\s+/)[0] ?? "";
}

export function fillQuickAnswer(template: string, authorName: string): string {
  const first = firstNameFromAuthor(authorName);
  if (first) return template.replaceAll("{name}", first);
  return template
    .replaceAll("{name}, ", "")
    .replaceAll(", {name}", "")
    .replaceAll("{name}", "friend");
}

const KEYWORD_ANSWERS: Array<{ id: string; pattern: RegExp }> = [
  { id: "roads", pattern: /\b(road|roads|pothole|flood|bridge|asphalt)\b/i },
  { id: "jobs", pattern: /\b(job|jobs|unemploy|youth|skill|work)\b/i },
  { id: "healthcare", pattern: /\b(hospital|clinic|health|doctor|medicine|phc)\b/i },
  { id: "security", pattern: /\b(security|kidnap|crime|thieves|safe|safety)\b/i },
  { id: "education", pattern: /\b(school|teacher|education|student|waec)\b/i },
  { id: "power-water", pattern: /\b(power|light|electric|nepa|water|borehole)\b/i },
  { id: "volunteer", pattern: /\b(volunteer|join|sign ?up|campaign team)\b/i },
];

export function recommendedQuickAnswerIds(
  comment: Pick<Comment, "sentiment" | "issue_topic" | "is_misinformation"> & {
    content?: string | null;
  }
): string[] {
  const ids: string[] = [];
  const topic = comment.issue_topic;
  const text = comment.content ?? "";

  if (comment.is_misinformation) ids.push("respectful");
  if (topic === "roads" || topic === "infrastructure") ids.push("roads", "look-into-it");
  if (topic === "employment" || topic === "youth" || topic === "economy") ids.push("jobs");
  if (topic === "healthcare") ids.push("healthcare");
  if (topic === "security") ids.push("security");
  if (topic === "education") ids.push("education");
  if (topic === "electricity" || topic === "water") ids.push("power-water");
  if (text) {
    for (const { id, pattern } of KEYWORD_ANSWERS) {
      if (pattern.test(text)) ids.push(id);
    }
  }
  if (comment.sentiment === "positive") ids.push("support", "thank-you");
  if (comment.sentiment === "negative") ids.push("look-into-it", "more-details");

  if (ids.length === 0) ids.push("thank-you", "look-into-it", "more-details");

  return [...new Set(ids)];
}

export function orderedQuickAnswers(
  comment: Pick<Comment, "sentiment" | "issue_topic" | "is_misinformation"> & {
    content?: string | null;
  }
): QuickAnswer[] {
  const recommendedIds = recommendedQuickAnswerIds(comment);
  const recommended = new Set(recommendedIds);
  const byId = new Map(QUICK_ANSWERS.map((answer) => [answer.id, answer]));
  return [
    ...recommendedIds.flatMap((id) => {
      const answer = byId.get(id);
      return answer ? [answer] : [];
    }),
    ...QUICK_ANSWERS.filter((answer) => !recommended.has(answer.id)),
  ];
}

/** Closest canned reply when staff skip the chips or OpenAI is unavailable. */
export function fallbackSuggestedReply(comment: {
  content: string;
  issue_topic?: Comment["issue_topic"];
  sentiment?: Comment["sentiment"];
  author_name: string;
  is_misinformation?: boolean | null;
}): string {
  const ids = recommendedQuickAnswerIds({
    sentiment: comment.sentiment,
    issue_topic: comment.issue_topic,
    is_misinformation: Boolean(comment.is_misinformation),
    content: comment.content,
  });
  const answer =
    QUICK_ANSWERS.find((item) => item.id === (ids[0] ?? "thank-you")) ?? QUICK_ANSWERS[0];
  return fillQuickAnswer(answer.body, comment.author_name);
}
