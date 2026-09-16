import { talkingPointFor } from "./topics.ts";

export const MEDIA_TONES = ["listen", "agenda", "shake"] as const;
export type MediaTone = (typeof MEDIA_TONES)[number];

export const MEDIA_TONE_COPY: Record<
  MediaTone,
  { label: string; hint: string }
> = {
  listen: {
    label: "Listen",
    hint: "Answer what people already raised in the comments",
  },
  agenda: {
    label: "Set the agenda",
    hint: "Thought-provoking — HQ chooses the question of the week",
  },
  shake: {
    label: "Shake the race",
    hint: "Hard questions for APC and other tickets — no slander",
  },
};

export function isMediaTone(value: string | null | undefined): value is MediaTone {
  return Boolean(value && MEDIA_TONES.includes(value as MediaTone));
}

const AGENDA_ANGLES: Record<string, string> = {
  employment:
    "If jobs are the story every cycle, what is the ward-level next step — not another slogan?",
  youth: "Young people are not a photo line. What is one skill, one volunteer step, one door they can walk through this week?",
  roads: "Which stretch still fails after every rainy season — and which wards live with it?",
  security: "Safety talk is cheap. Which community is still waiting, and what rumour should we refuse?",
  education: "Name the school and the teachers, not a generic ‘we love education’ line.",
  healthcare: "Which rural health centre is the follow-up — and which ward asked first?",
  electricity: "Power as residents described it. No grid fairy tales. Which feeder still dies at night?",
  water: "Which borehole or supply is failing, and who is supposed to own the repair?",
  agriculture: "Stand with farmers on one input or access issue they already named.",
  economy: "Cost of living as people live it. No invented figures. What would make market week cheaper?",
  women: "Which market or women-led ward conversation is still unanswered?",
  infrastructure: "Pick one visible project residents already named. Coverage is not completion.",
  corruption: "Keep it to process and records. Who publishes what, and when?",
  other: "Answer the actual complaint. Do not invent a programme to sound busy.",
  "fact-check": "What is false, what is true, what we will not invent.",
  inbox: "Thank the commenters and ask for the ward before a new slogan post.",
};

const SHAKE_ANGLES: Record<string, string> = {
  employment:
    "APC and the other tickets say jobs are already covered. If that were true, why are young people still waiting for names, wards, and start dates?",
  youth:
    "Who treated young people as a rally crowd, and who is offering a next step they can take this week?",
  roads:
    "Every ticket has a roads brochure. Which stretch is still a campaign talking point after the last rain?",
  security:
    "If safety is already ‘handled,’ why are communities still trading rumours instead of facts?",
  education:
    "Who will name the school, the teachers, and the ward — not the slogan?",
  healthcare:
    "Coverage on health is not a clinic. Which ward still has no follow-up?",
  electricity:
    "Who promised light and left the feeder as residents described it?",
  water:
    "Which community still queues for water while the brochures say the ground is covered?",
  agriculture:
    "Farmers do not need another photo. They need one input or access answer the other tickets skipped.",
  economy:
    "If the economy talking points are done, why is market week still the argument in the comments?",
  women:
    "Which market conversation did the other tickets walk past?",
  infrastructure:
    "Point to one project residents already named. ‘We spoke on this’ is not a completion certificate.",
  corruption:
    "Ask for the record, not a rumour. Who publishes the paper trail?",
  other:
    "The other tickets had the airwaves. What ward-level fact do they still not have?",
  "fact-check":
    "A rumour left standing is a gift to whoever started it. Correct it without inventing a counter-claim.",
  inbox:
    "You cannot take the media space while the inbox is on fire. Clear it, then set the question.",
};

export function agendaAngleFor(topic: string): string {
  return AGENDA_ANGLES[topic] ?? talkingPointFor(topic);
}

export function shakeAngleFor(topic: string): string {
  return SHAKE_ANGLES[topic] ?? talkingPointFor(topic);
}

export function angleFor(topic: string, tone: MediaTone): string {
  if (tone === "shake") return shakeAngleFor(topic);
  if (tone === "agenda") return agendaAngleFor(topic);
  return talkingPointFor(topic);
}
