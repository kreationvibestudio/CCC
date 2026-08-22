import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parsePartyVotes, totalPartyVotes, votesFromFields } from "./parties.ts";

describe("parsePartyVotes", () => {
  it("uppercases codes and drops invalid counts", () => {
    assert.deepEqual(parsePartyVotes({ ndc: "12", apc: -1, x: "nope" }), { NDC: 12 });
  });
});

describe("votesFromFields", () => {
  it("merges featured fields with extra party rows", () => {
    const votes = votesFromFields({ APC: "10", PDP: "" }, [{ code: "lp", votes: "3" }]);
    assert.deepEqual(votes, { APC: 10, LP: 3 });
    assert.equal(totalPartyVotes(votes), 13);
  });
});
