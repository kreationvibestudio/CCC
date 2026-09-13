import assert from "node:assert/strict";
import { test } from "node:test";
import { fallbackSuggestedReply } from "../comments/quick-answers.ts";

test("fallback reply for a roads complaint uses the roads quick answer and the first name", () => {
  const reply = fallbackSuggestedReply({
    content: "The road in Uselu floods every time it rains",
    issue_topic: "roads",
    sentiment: "negative",
    author_name: "Ada Okojie",
    is_misinformation: false,
  });
  assert.match(reply, /^Ada,/);
  assert.match(reply, /roads/i);
  assert.ok(!reply.includes("{name}"));
});

test("fallback reply for praise uses a thank-you, not a complaint template", () => {
  const reply = fallbackSuggestedReply({
    content: "God bless the governor, keep it up",
    issue_topic: "other",
    sentiment: "positive",
    author_name: "Osagie E.",
    is_misinformation: false,
  });
  assert.match(reply, /Thank you/i);
  assert.match(reply, /Osagie/);
});

test("fallback reply for a rumour uses the respectful close", () => {
  const reply = fallbackSuggestedReply({
    content: "I heard they have cancelled the project",
    issue_topic: "other",
    sentiment: "negative",
    author_name: "Blessing",
    is_misinformation: true,
  });
  assert.match(reply, /factual and respectful/i);
});
