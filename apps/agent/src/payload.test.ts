import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { localPhoto, publicPayload } from "./payload.ts";

describe("publicPayload", () => {
  it("strips local photo keys before the API sees the body", () => {
    const body = publicPayload({
      polling_unit_id: "pu-1",
      _localPhoto: "file:///photo.jpg",
      _photoKind: "result_sheet",
      empty: "",
    });
    assert.deepEqual(body, { polling_unit_id: "pu-1" });
  });
});

describe("localPhoto", () => {
  it("reads a queued camera file", () => {
    assert.deepEqual(localPhoto({ _localPhoto: "file:///a.jpg", _photoKind: "incident" }), {
      uri: "file:///a.jpg",
      kind: "incident",
    });
    assert.equal(localPhoto({ polling_unit_id: "x" }), null);
  });
});
