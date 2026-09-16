import type { IssueTopic } from "../../types/database.ts";

export const ISSUE_TOPICS: IssueTopic[] = [
  "security",
  "roads",
  "education",
  "healthcare",
  "agriculture",
  "economy",
  "employment",
  "youth",
  "women",
  "electricity",
  "water",
  "corruption",
  "infrastructure",
  "other",
];

/** Beats HQ can pick. `other` stays a fallback, not a chip. */
export const PICKABLE_TOPICS: IssueTopic[] = ISSUE_TOPICS.filter((topic) => topic !== "other");

export const TOPIC_LABELS: Record<IssueTopic, string> = {
  security: "Security",
  roads: "Roads",
  education: "Education",
  healthcare: "Healthcare",
  agriculture: "Agriculture",
  economy: "Cost of living",
  employment: "Jobs",
  youth: "Youth",
  women: "Women",
  electricity: "Power",
  water: "Water",
  corruption: "Accountability",
  infrastructure: "Infrastructure",
  other: "Other",
};

export function isIssueTopic(value: string | null | undefined): value is IssueTopic {
  return Boolean(value && ISSUE_TOPICS.includes(value as IssueTopic));
}

export function topicLabel(topic: string): string {
  if (topic === "fact-check") return "Fact-check";
  if (topic === "inbox") return "Inbox";
  return isIssueTopic(topic) ? TOPIC_LABELS[topic] : topic.replace(/_/g, " ");
}

/** Concrete next-post lines — never “post more.” */
export const ISSUE_TALKING_POINTS: Record<IssueTopic, string> = {
  roads: "Name one stretch and the wards it serves — no invented completion dates",
  employment: "State one concrete youth or job step already in motion",
  youth: "Invite young people to one skills or volunteer next step",
  healthcare: "Point to rural health centres and ask which ward needs follow-up",
  security: "Acknowledge safety concerns and ask for the community, not rumours",
  education: "Talk about schools and teachers in the wards that raised it",
  electricity: "Repeat the power issue as residents said it — no grid promises",
  water: "Ask which community borehole or supply is failing",
  agriculture: "Stand with farmers on one practical input or access issue",
  economy: "Stay with cost of living as people described it — no invented figures",
  women: "Highlight one women-led ward or market conversation",
  infrastructure: "Pick one visible project residents already named",
  corruption: "Keep it factual: process and records, not accusations",
  other: "Answer the actual complaint in the last comments — do not invent a programme",
};

export function talkingPointFor(topic: string): string {
  return isIssueTopic(topic) ? ISSUE_TALKING_POINTS[topic] : ISSUE_TALKING_POINTS.other;
}
