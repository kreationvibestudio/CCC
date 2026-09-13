import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  UNKNOWN_FACEBOOK_AUTHOR,
  UNKNOWN_FACEBOOK_AUTHOR_LABEL,
  displayFacebookAuthor,
  isPlaceholderFacebookAuthor,
  resolveFacebookCommentAuthor,
} from "./comment-author.ts";

describe("resolveFacebookCommentAuthor", () => {
  it("prefers the commenter's display name", () => {
    const resolved = resolveFacebookCommentAuthor({
      from: { name: "Ada Okojie", username: "ada.okojie" },
    });
    assert.equal(resolved.authorName, "Ada Okojie");
    assert.equal(resolved.username, "ada.okojie");
  });

  it("uses username when Facebook omits name", () => {
    const resolved = resolveFacebookCommentAuthor({
      from: { id: "123", username: "blessing.esan" },
    });
    assert.equal(resolved.authorName, "blessing.esan");
  });

  it("uses a top-level username when from is missing", () => {
    const resolved = resolveFacebookCommentAuthor({ username: "chidi.uromi" });
    assert.equal(resolved.authorName, "chidi.uromi");
  });

  it("joins first and last name when full name is missing", () => {
    const resolved = resolveFacebookCommentAuthor({
      from: { first_name: "Grace", last_name: "E." },
    });
    assert.equal(resolved.authorName, "Grace E.");
  });

  it("keeps a previously stored real name when Graph sends no author", () => {
    const resolved = resolveFacebookCommentAuthor({}, "Ibrahim K.");
    assert.equal(resolved.authorName, "Ibrahim K.");
  });

  it("does not keep the generic Facebook User placeholder", () => {
    const resolved = resolveFacebookCommentAuthor({}, "Facebook User");
    assert.equal(resolved.authorName, UNKNOWN_FACEBOOK_AUTHOR);
    assert.equal(isPlaceholderFacebookAuthor("Facebook User"), true);
  });

  it("shows Unknown commenter instead of Facebook User in the inbox", () => {
    assert.equal(displayFacebookAuthor("Facebook User"), UNKNOWN_FACEBOOK_AUTHOR_LABEL);
    assert.equal(displayFacebookAuthor("Ada Okojie"), "Ada Okojie");
    assert.equal(isPlaceholderFacebookAuthor("Unknown commenter"), true);
  });

  it("reads the profile picture url", () => {
    const resolved = resolveFacebookCommentAuthor({
      from: {
        name: "Ruth I.",
        picture: { data: { url: "https://example.com/r.jpg" } },
      },
    });
    assert.equal(resolved.authorAvatar, "https://example.com/r.jpg");
  });
});
