import { talkingPointFor } from "./topics.ts";

export type DraftPost = {
  title: string;
  body: string;
  talking_points: string[];
};

export function fallbackDraftPost(topic: string, comments: string[] = []): DraftPost {
  const talking = talkingPointFor(topic);
  const hint = comments[0]?.replace(/\s+/g, " ").trim().slice(0, 80);
  const title =
    topic === "fact-check"
      ? "Set the record straight"
      : topic === "inbox"
        ? "We are reading every comment"
        : topic === "other"
          ? "We hear you"
          : `On ${topic}`;
  const body =
    topic === "fact-check"
      ? "Please share only what you can verify. If you heard a rumour, send the ward and we will check it. We will not invent claims."
      : hint
        ? `We hear you on ${topic}. You wrote about “${hint}”. ${talking}. Reply with your ward so the team can follow up.`
        : `We hear you on ${topic}. ${talking}. Reply with your ward so the team can follow up.`;
  return {
    title,
    body: body.slice(0, 280),
    talking_points: [talking, "Ask for the ward or community", "Do not invent a timeline"],
  };
}
