import { talkingPointFor, topicLabel } from "./topics.ts";
import { angleFor, isMediaTone, type MediaTone } from "./tones.ts";

export type DraftPost = {
  title: string;
  body: string;
  article: string;
  tone: MediaTone;
  talking_points: string[];
};

export const TONE_PREFIX = "tone:";
export const ARTICLE_PREFIX = "article:";

const FACEBOOK_MAX = {
  listen: 280,
  agenda: 720,
  shake: 720,
} as const;

export function packTalkingPoints(draft: Pick<DraftPost, "article" | "tone" | "talking_points">): string[] {
  const points = draft.talking_points
    .map((item) => item.trim())
    .filter((item) => item && !item.startsWith(TONE_PREFIX) && !item.startsWith(ARTICLE_PREFIX));
  const packed = [`${TONE_PREFIX}${draft.tone}`];
  const article = draft.article.trim();
  if (article) packed.push(`${ARTICLE_PREFIX}${article}`);
  packed.push(...points);
  return packed.slice(0, 8);
}

export function unpackTalkingPoints(raw: string[]): {
  tone: MediaTone | null;
  article: string | null;
  points: string[];
} {
  let tone: MediaTone | null = null;
  let article: string | null = null;
  const points: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const value = item.trim();
    if (!value) continue;
    if (value.startsWith(TONE_PREFIX)) {
      const maybe = value.slice(TONE_PREFIX.length).trim();
      if (isMediaTone(maybe)) tone = maybe;
      continue;
    }
    if (value.startsWith(ARTICLE_PREFIX)) {
      const text = value.slice(ARTICLE_PREFIX.length).trim();
      if (text) article = text;
      continue;
    }
    points.push(value);
  }
  return { tone, article, points };
}

function firstHint(comments: string[]): string {
  return comments[0]?.replace(/\s+/g, " ").trim().slice(0, 80) ?? "";
}

function listenFallback(topic: string, comments: string[]): DraftPost {
  const talking = talkingPointFor(topic);
  const hint = firstHint(comments);
  const label = topicLabel(topic);
  const title =
    topic === "fact-check"
      ? "Set the record straight"
      : topic === "inbox"
        ? "We are reading every comment"
        : topic === "other"
          ? "We hear you"
          : `On ${label.toLowerCase()}`;
  const body =
    topic === "fact-check"
      ? "Please share only what you can verify. If you heard a rumour, send the ward and we will check it. We will not invent claims."
      : hint
        ? `We hear you on ${label.toLowerCase()}. You wrote about “${hint}”. ${talking}. Reply with your ward so the team can follow up.`
        : `We hear you on ${label.toLowerCase()}. ${talking}. Reply with your ward so the team can follow up.`;
  const article = [
    `People in the comments are raising ${label.toLowerCase()}. That is a queue, not a slogan.`,
    hint
      ? `One of you wrote about “${hint}”. We will not invent a programme to fill the silence.`
      : `We will not invent a programme to fill the silence.`,
    `The next useful line names a ward, a stretch, a clinic, or a school — the place the commenter already lives. ${talking}.`,
    `If you wrote about this, reply with your ward. Hon Akhakon Anenih's media desk will follow up in public, with facts we can stand on.`,
  ].join(" ");
  return {
    title,
    body: body.slice(0, FACEBOOK_MAX.listen),
    article,
    tone: "listen",
    talking_points: [talking, "Ask for the ward or community", "Do not invent a timeline"],
  };
}

function agendaFallback(topic: string, comments: string[]): DraftPost {
  const label = topicLabel(topic);
  const angle = angleFor(topic, "agenda");
  const hint = firstHint(comments);
  const title = `The ${label.toLowerCase()} question this week`;
  const body = hint
    ? `Edo does not need another ${label.toLowerCase()} press statement. People already wrote about “${hint}”. The question Hon Akhakon Anenih is putting on the table: ${angle}`
    : `Edo does not need another ${label.toLowerCase()} press statement. The question Hon Akhakon Anenih is putting on the table: ${angle}`;
  const article = [
    `A campaign that wants to own the media space chooses the question of the week. This week it is ${label.toLowerCase()}.`,
    angle,
    `Parties that already “covered the ground” can answer with wards and start-lines, or they can repeat the brochure. The public can tell the difference.`,
    `Hon Akhakon Anenih's desk will keep that question in Facebook, in forwards, and in the huddle until the race is about delivery. We will not invent a budget, a date, or a project name to sound ready.`,
    `If you have a ward-level fact on ${label.toLowerCase()}, send the ward. Thought-provoking is not the same as reckless.`,
  ].join(" ");
  return {
    title,
    body: body.slice(0, FACEBOOK_MAX.agenda),
    article,
    tone: "agenda",
    talking_points: [angle, "Ask for the ward or community", "Do not invent a timeline"],
  };
}

function shakeFallback(topic: string, comments: string[]): DraftPost {
  const label = topicLabel(topic);
  const angle = angleFor(topic, "shake");
  const hint = firstHint(comments);
  const title = `Has ${label.toLowerCase()} really been covered?`;
  const heat = hint ? ` The comments are still arguing about “${hint}”.` : "";
  const body =
    `APC and the other tickets say ${label.toLowerCase()} is already covered.${heat} Then why is Edo still waiting? Hon Akhakon Anenih is asking the question they skip: ${angle} Reply with your ward — not a slogan.`;
  const article = [
    `APC and the other tickets have had the airwaves on ${label.toLowerCase()}. If the ground is covered, why is the comment section still arguing?`,
    `A campaign that wants to catch up does not do it by inventing scandals. It does it by refusing slogan coverage.`,
    `Hon Akhakon Anenih is asking the question they skip: ${angle}`,
    `Name the ward. Name the start. Name who is accountable. Until those three exist, “we have already spoken on this” is not an answer.`,
    `Edo should make ${label.toLowerCase()} expensive for anyone who treats it as a closed file. Share this. Reply with a place, not a party chant. We will not write a crime we cannot prove.`,
  ].join(" ");
  return {
    title,
    body: body.slice(0, FACEBOOK_MAX.shake),
    article,
    tone: "shake",
    talking_points: [angle, "Ask for the ward or community", "No invented accusations"],
  };
}

export function fallbackDraftPost(
  topic: string,
  comments: string[] = [],
  tone: MediaTone = "listen"
): DraftPost {
  if (tone === "shake") return shakeFallback(topic, comments);
  if (tone === "agenda") return agendaFallback(topic, comments);
  return listenFallback(topic, comments);
}
