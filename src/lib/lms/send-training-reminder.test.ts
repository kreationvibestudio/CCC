import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { reminderChannels, trainingReminderSms } from "./training-reminder-copy.ts";

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
    assert.match(body, /overdue/);
    assert.match(body, /https:\/\/ccc\.example\/learn\/edo\/login/);
    assert.match(body, /ABCD-EFGH/);
  });
});
