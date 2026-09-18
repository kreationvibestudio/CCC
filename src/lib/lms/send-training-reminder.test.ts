import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  reminderChannels,
  reminderConfirmCopy,
  reminderRecipients,
  trainingReminderLearnUrl,
  trainingReminderSms,
} from "./training-reminder-copy.ts";

describe("reminderChannels", () => {
  it("uses every configured channel the volunteer can receive", () => {
    assert.deepEqual(
      reminderChannels({
        phone: "08031234567",
        email: "ada@example.com",
        whatsappOn: true,
        emailOn: true,
        smsOn: true,
      }),
      { whatsapp: true, email: true, sms: true }
    );
  });

  it("skips channels that are off or missing a destination", () => {
    assert.deepEqual(
      reminderChannels({
        phone: "08031234567",
        email: null,
        whatsappOn: false,
        emailOn: true,
        smsOn: true,
      }),
      { whatsapp: false, email: false, sms: true }
    );
    assert.deepEqual(
      reminderChannels({
        phone: "  ",
        email: "ada@example.com",
        whatsappOn: true,
        emailOn: true,
        smsOn: true,
      }),
      { whatsapp: false, email: true, sms: false }
    );
  });
});

describe("trainingReminderSms", () => {
  it("includes first name, login URL, phone username, and training code", () => {
    const body = trainingReminderSms({
      name: "Ada Firstlogin",
      phone: "08031234567",
      learnUrl: "https://ccc.example/learn/edo/login",
      trainingCode: "ABCD-EFGH",
    });
    assert.match(body, /^Hi Ada,/);
    assert.match(body, /you need to complete volunteer training/);
    assert.match(body, /https:\/\/ccc\.example\/learn\/edo\/login/);
    assert.match(body, /Username \(phone\): 08031234567/);
    assert.match(body, /Code: ABCD-EFGH/);
  });
});

describe("trainingReminderLearnUrl", () => {
  it("puts the phone username on the login link", () => {
    assert.equal(
      trainingReminderLearnUrl("https://ccc.example/learn/edo/login", "08031234567"),
      "https://ccc.example/learn/edo/login?phone=08031234567"
    );
  });
});

describe("reminderRecipients", () => {
  const volunteers = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
  const overdue = [{ id: "b" }];
  const notStarted = [{ id: "a" }, { id: "b" }];

  it("sends to the selected rows, not only overdue or not started", () => {
    const result = reminderRecipients({
      selectedIds: ["c"],
      volunteers,
      notStarted,
      overdue,
    });
    assert.equal(result.audience, "selected");
    assert.deepEqual(
      result.people.map((row) => row.id),
      ["c"]
    );
  });

  it("falls back to people who have not started or are overdue", () => {
    const result = reminderRecipients({
      selectedIds: [],
      volunteers,
      notStarted,
      overdue,
    });
    assert.equal(result.audience, "needs_training");
    assert.deepEqual(
      result.people.map((row) => row.id),
      ["a", "b"]
    );
  });

  it("is empty when there is no selection and nobody needs a reminder", () => {
    const result = reminderRecipients({
      selectedIds: [],
      volunteers,
      notStarted: [],
      overdue: [],
    });
    assert.equal(result.audience, "none");
    assert.equal(result.people.length, 0);
  });
});

describe("reminderConfirmCopy", () => {
  it("asks about the selected rows even when nobody is overdue", () => {
    const result = reminderConfirmCopy({ selectedCount: 23, needsTrainingCount: 0 });
    assert.equal(result.ok, true);
    assert.equal(result.audience, "selected");
    assert.match(result.message, /23 selected volunteer/);
    assert.match(result.message, /phone \(login username\), training code/);
    assert.doesNotMatch(result.message, /overdue|Send anyway/i);
  });

  it("names not-started and overdue people when nothing is selected", () => {
    const result = reminderConfirmCopy({ selectedCount: 0, needsTrainingCount: 20 });
    assert.equal(result.audience, "needs_training");
    assert.match(result.message, /20 volunteer/);
    assert.match(result.message, /have not started or are overdue/);
  });

  it("blocks send when there is no selection and nobody needs a reminder", () => {
    const result = reminderConfirmCopy({ selectedCount: 0, needsTrainingCount: 0 });
    assert.equal(result.ok, false);
    assert.match(result.message, /has not started training or is overdue/);
  });
});
