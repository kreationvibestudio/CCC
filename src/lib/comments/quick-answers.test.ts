import assert from "node:assert/strict";
import { test } from "node:test";
import {
  QUICK_ANSWERS,
  fillQuickAnswer,
  firstNameFromAuthor,
  orderedQuickAnswers,
  recommendedQuickAnswerIds,
} from "./quick-answers.ts";

test("there are at least eight distinct quick answers with usable copy", () => {
  assert.ok(QUICK_ANSWERS.length >= 8);
  const ids = QUICK_ANSWERS.map((answer) => answer.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const answer of QUICK_ANSWERS) {
    assert.ok(answer.label.trim().length >= 3);
    assert.ok(answer.body.includes("{name}"));
    assert.ok(answer.body.replaceAll("{name}", "Ada").trim().length >= 40);
    assert.ok(answer.body.length <= 320);
  }
});

test("fillQuickAnswer uses the first name and still reads when the name is missing", () => {
  assert.equal(firstNameFromAuthor("Ada Okojie"), "Ada");
  const withName = fillQuickAnswer("Thank you, {name}. We hear you.", "Ada Okojie");
  assert.equal(withName, "Thank you, Ada. We hear you.");
  const withoutName = fillQuickAnswer("{name}, we hear you.", "   ");
  assert.equal(withoutName, "we hear you.");
});

test("road complaints recommend the roads answer first", () => {
  const ids = recommendedQuickAnswerIds({
    sentiment: "negative",
    issue_topic: "roads",
    is_misinformation: false,
  });
  assert.equal(ids[0], "roads");
  assert.ok(ids.includes("look-into-it"));
  assert.equal(orderedQuickAnswers({
    sentiment: "negative",
    issue_topic: "roads",
    is_misinformation: false,
  })[0].id, "roads");
});

test("praise recommends a support thank-you, rumours recommend a respectful close", () => {
  assert.ok(
    recommendedQuickAnswerIds({
      sentiment: "positive",
      issue_topic: "other",
      is_misinformation: false,
    }).includes("support")
  );
  assert.equal(
    recommendedQuickAnswerIds({
      sentiment: "neutral",
      issue_topic: "other",
      is_misinformation: true,
    })[0],
    "respectful"
  );
});

test("unclassified comment text still recommends a matching quick answer", () => {
  const ids = recommendedQuickAnswerIds({
    sentiment: "neutral",
    issue_topic: "other",
    is_misinformation: false,
    content: "Please I want to volunteer in my ward",
  });
  assert.ok(ids.includes("volunteer"));
});
