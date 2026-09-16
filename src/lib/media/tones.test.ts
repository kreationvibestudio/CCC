import assert from "node:assert/strict";
import { test } from "node:test";
import { ISSUE_TOPICS, PICKABLE_TOPICS, topicLabel } from "./topics.ts";
import { agendaAngleFor, angleFor, shakeAngleFor } from "./tones.ts";

test("every issue topic has a chip label and other is not pickable", () => {
  for (const topic of ISSUE_TOPICS) {
    assert.ok(topicLabel(topic).length > 0);
  }
  assert.equal(topicLabel("employment"), "Jobs");
  assert.ok(!PICKABLE_TOPICS.includes("other"));
  assert.ok(PICKABLE_TOPICS.includes("employment"));
  assert.equal(PICKABLE_TOPICS.length, ISSUE_TOPICS.length - 1);
});

test("agenda and shake angles exist for every pickable beat and stay non-slanderous", () => {
  const dirty = /stole|embezzl|criminal|arrest|thief/i;
  for (const topic of PICKABLE_TOPICS) {
    const agenda = agendaAngleFor(topic);
    const shake = shakeAngleFor(topic);
    assert.ok(agenda.length > 20, topic);
    assert.ok(shake.length > 20, topic);
    assert.ok(!dirty.test(agenda), topic);
    assert.ok(!dirty.test(shake), topic);
    assert.equal(angleFor(topic, "agenda"), agenda);
    assert.equal(angleFor(topic, "shake"), shake);
  }
});
