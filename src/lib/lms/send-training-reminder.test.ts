import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  reminderChannels,
  reminderConfirmCopy,
  reminderRecipients,
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
  it("includes first name, login URL, and training code", () => {
    const body = trainingReminderSms({
      name: "Ada Firstlogin",
      learnUrl: "https://ccc.example/learn/edo/login",
      trainingCode: "ABCD-EFGH",
    });
    assert.match(body, /^Hi Ada,/);
    assert.match(body, /please finish your volunteer training/);
    assert.match(body, /https:\/\/ccc\.example\/learn\/edo\/login/);
    assert.match(body, /ABCD-EFGH/);
  });
});

describe("reminderRecipients", () => {
  const volunteers = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const overdue = [{ id: "b" }];

  it("sends to the selected rows, not only overdue", () => {
    const result = reminderRecipients({
      selectedIds: ["a", "c"],
      volunteers,
      overdue,
    });
    assert.equal(result.audience, "selected");
    assert.deepEqual(
      result.people.map((row) => row.id),
      ["a", "c"]
    );
  });

  it("falls back to overdue when nothing is selected", () => {
    const result = reminderRecipients({ selectedIds: [], volunteers, overdue });
    assert.equal(result.audience, "overdue");
    assert.deepEqual(
      result.people.map((row) => row.id),
      ["b"]
    );
  });

  it("is empty when there is no selection and nobody is overdue", () => {
    const result = reminderRecipients({ selectedIds: [], volunteers, overdue: [] });
    assert.equal(result.audience, "none");
    assert.equal(result.people.length, 0);
  });
});

describe("reminderConfirmCopy", () => {
  it("asks about the selected rows even when overdue is zero", () => {
    const result = reminderConfirmCopy({ selectedCount: 23, overdueCount: 0 });
    assert.equal(result.ok, true);
    assert.equal(result.audience, "selected");
    assert.match(result.message, /23 selected volunteer/);
    assert.doesNotMatch(result.message, /overdue|Send anyway/i);
  });

  it("falls back to overdue only when nothing is selected", () => {
    const result = reminderConfirmCopy({ selectedCount: 0, overdueCount: 4 });
    assert.equal(result.audience, "overdue");
    assert.match(result.message, /overdue training reminders to 4 volunteer/);
  });

  it("blocks send when there is no selection and nobody is overdue", () => {
    const result = reminderConfirmCopy({ selectedCount: 0, overdueCount: 0 });
    assert.equal(result.ok, false);
    assert.match(result.message, /Select volunteers in the People table/);
  });
});
