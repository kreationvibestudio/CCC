import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildSelfContainedPitchHtml } from "./build-html.ts";

describe("buildSelfContainedPitchHtml", () => {
  it("inlines pitch assets as data URIs", () => {
    const html = buildSelfContainedPitchHtml();
    assert.match(html, /data:image\/webp;base64,/);
    assert.match(html, /data:image\/png;base64,/);
    assert.doesNotMatch(html, /\.\/pitch-assets\//);
    assert.match(html, /Run the campaign from one war room/);
    assert.match(html, /₦9\.5M/);
  });
});
