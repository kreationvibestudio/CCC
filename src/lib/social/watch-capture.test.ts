import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCapturedWatchPost,
  canonicalizeFacebookUrl,
  isFacebookPostOrShareUrl,
  matchCampaignKeywords,
  normalizeFacebookUsername,
  parseOpenGraphTags,
  usernameFromFacebookUrl,
} from "./watch-capture.ts";

describe("normalizeFacebookUsername", () => {
  it("accepts bare handles and profile URLs", () => {
    assert.equal(normalizeFacebookUsername("akhogba.armani"), "akhogba.armani");
    assert.equal(normalizeFacebookUsername("https://www.facebook.com/akhogba.armani"), "akhogba.armani");
    assert.equal(normalizeFacebookUsername("@DrCharles"), "DrCharles");
  });
});

describe("isFacebookPostOrShareUrl", () => {
  it("accepts share and posts URLs", () => {
    assert.equal(isFacebookPostOrShareUrl("https://web.facebook.com/share/p/1A1V6Sckpw/"), true);
    assert.equal(
      isFacebookPostOrShareUrl(
        "https://www.facebook.com/akhogba.armani/posts/pfbid0tCXT3D9FT3HEjBqn6cwc3tZeFUwMxMxuZmGdwRC7KcQPzJuTosEQAcQjMRmMc68Dl"
      ),
      true
    );
    assert.equal(isFacebookPostOrShareUrl("https://www.facebook.com/akhogba.armani"), false);
    assert.equal(isFacebookPostOrShareUrl("https://example.com/share/p/x"), false);
  });
});

describe("parseOpenGraphTags", () => {
  it("reads the Akhogba share metadata shape", () => {
    const html = `
      <meta property="og:title" content="Akhogba Era Armani" />
      <meta property="og:description" content="Today is November 7th , just few days to the elections, again I ask , where is Owanlen Akin Anenih ?????" />
      <meta property="og:url" content="https://www.facebook.com/akhogba.armani/posts/today-is-november-7th/30098504133070389/" />
    `;
    const og = parseOpenGraphTags(html);
    assert.equal(og.title, "Akhogba Era Armani");
    assert.match(og.description ?? "", /elections/i);
    assert.match(og.url ?? "", /akhogba\.armani/);
  });
});

describe("buildCapturedWatchPost", () => {
  it("canonicalizes, extracts username, and flags campaign keywords", () => {
    const captured = buildCapturedWatchPost({
      sourceUrl: "https://web.facebook.com/share/p/1A1V6Sckpw/",
      finalUrl:
        "https://www.facebook.com/akhogba.armani/posts/pfbid0tCXT3D9FT3HEjBqn6cwc3tZeFUwMxMxuZmGdwRC7KcQPzJuTosEQAcQjMRmMc68Dl?rdid=UaFc1NVvSe1V8UuA",
      og: {
        title: "Akhogba Era Armani",
        description:
          "Today is November 7th , just few days to the elections, again I ask , where is Owanlen Akin Anenih ?????",
        url: "https://www.facebook.com/akhogba.armani/posts/today-is-november-7th/30098504133070389/",
      },
      keywords: ["election", "elections", "Anenih", "Edo"],
    });
    assert.equal(captured.facebookUsername, "akhogba.armani");
    assert.equal(captured.authorName, "Akhogba Era Armani");
    assert.ok(captured.keywordHits.map((h) => h.toLowerCase()).includes("elections"));
    assert.equal(usernameFromFacebookUrl(captured.canonicalUrl), "akhogba.armani");
    assert.ok(!canonicalizeFacebookUrl(captured.canonicalUrl).includes("rdid="));
  });
});

describe("matchCampaignKeywords", () => {
  it("matches phrases and ignores missing terms", () => {
    assert.deepEqual(matchCampaignKeywords("Labour Party rally in Edo", ["Labour Party", "zzz"]), [
      "Labour Party",
    ]);
  });
});
