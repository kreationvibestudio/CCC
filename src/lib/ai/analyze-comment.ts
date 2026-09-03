import type { IssueTopic, SentimentCategory } from "@/types/database";
import { openAiChatCompletion } from "@/lib/ai/openai";

export interface CommentAnalysis {
  sentiment: SentimentCategory;
  issue_topic: IssueTopic;
  priority_score: number;
  is_misinformation: boolean;
  is_abusive: boolean;
}

const POSITIVE = ["thank", "great", "love", "support", "excellent", "proud", "bless", "good job", "well done", "amazing", "best", "hope", "together", "progress"];
const NEGATIVE = ["bad", "worst", "hate", "fail", "corrupt", "liar", "useless", "disappoint", "angry", "shame", "terrible", "pothole", "crisis", "problem"];
const MISINFO = ["withdrew", "withdraw", "dead", "died", "scandal", "fake", "rumor", "rumour", "not true", "false", "misinformation", "debunk"];
const ABUSIVE = ["idiot", "stupid", "fool", "bastard", "nonsense"];

const ISSUE_KEYWORDS: Record<IssueTopic, string[]> = {
  security: ["security", "kidnap", "crime", "police", "safety", "bandit", "insecurity"],
  roads: ["road", "pothole", "highway", "bridge", "street", "infrastructure", "transport"],
  education: ["school", "education", "teacher", "student", "university", "learning"],
  healthcare: ["health", "hospital", "clinic", "doctor", "medical", "healthcare"],
  agriculture: ["farm", "agriculture", "farmer", "crop", "food security"],
  economy: ["economy", "economic", "inflation", "cost", "price", "poverty"],
  employment: ["job", "employment", "unemployed", "youth", "work", "salary"],
  youth: ["youth", "young", "student", "graduate"],
  women: ["women", "gender", "girl", "maternal"],
  electricity: ["electricity", "power", "nepa", "light", "grid"],
  water: ["water", "borehole", "supply"],
  corruption: ["corrupt", "corruption", "bribe", "steal", "embezzle"],
  infrastructure: ["infrastructure", "development", "project"],
  other: [],
};

function countMatches(text: string, words: string[]) {
  const lower = text.toLowerCase();
  return words.filter((w) => lower.includes(w)).length;
}

export function analyzeCommentText(content: string): CommentAnalysis {
  const text = content.toLowerCase();
  const pos = countMatches(text, POSITIVE);
  const neg = countMatches(text, NEGATIVE);
  const is_misinformation = countMatches(text, MISINFO) > 0;
  const is_abusive = countMatches(text, ABUSIVE) > 0;

  let sentiment: SentimentCategory = "neutral";
  if (pos > neg) sentiment = "positive";
  else if (neg > pos) sentiment = "negative";

  let issue_topic: IssueTopic = "other";
  let maxScore = 0;
  for (const [topic, keywords] of Object.entries(ISSUE_KEYWORDS) as [IssueTopic, string[]][]) {
    if (topic === "other") continue;
    const score = countMatches(text, keywords);
    if (score > maxScore) {
      maxScore = score;
      issue_topic = topic;
    }
  }

  let priority_score = 50;
  if (sentiment === "negative") priority_score += 25;
  if (is_misinformation) priority_score += 30;
  if (is_abusive) priority_score += 20;
  if (sentiment === "positive") priority_score -= 15;
  priority_score = Math.min(100, Math.max(0, priority_score));

  return { sentiment, issue_topic, priority_score, is_misinformation, is_abusive };
}

export async function analyzeCommentWithAI(content: string): Promise<CommentAnalysis> {
  const ai = await openAiChatCompletion({
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content: `Analyze this Nigerian political campaign comment. Return JSON only: {"sentiment":"positive|neutral|negative","issue_topic":"security|roads|education|healthcare|agriculture|economy|employment|youth|women|electricity|water|corruption|infrastructure|other","priority_score":0-100,"is_misinformation":bool,"is_abusive":bool}`,
      },
      { role: "user", content },
    ],
  });
  if (!ai.ok) return analyzeCommentText(content);

  try {
    const parsed = JSON.parse(ai.text) as Partial<CommentAnalysis> & Record<string, unknown>;
    return {
      sentiment: (parsed.sentiment as CommentAnalysis["sentiment"]) ?? "neutral",
      issue_topic: (parsed.issue_topic as CommentAnalysis["issue_topic"]) ?? "other",
      priority_score: typeof parsed.priority_score === "number" ? parsed.priority_score : 50,
      is_misinformation: Boolean(parsed.is_misinformation),
      is_abusive: Boolean(parsed.is_abusive),
    };
  } catch {
    return analyzeCommentText(content);
  }
}
