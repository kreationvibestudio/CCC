import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { catalogCoverageComplete } from "./catalog-coverage.ts";

const CATALOG = [
  { slug: "core", modules: [{ slug: "values" }, { slug: "quiz" }] },
  { slug: "canvass", modules: [{ slug: "field" }] },
];

describe("catalogCoverageComplete", () => {
  it("is incomplete when nothing is stored", () => {
    assert.equal(catalogCoverageComplete(CATALOG, [], []), false);
  });

  it("is complete when every catalog course and module slug is present", () => {
    assert.equal(
      catalogCoverageComplete(
        CATALOG,
        [
          { id: "c1", slug: "core" },
          { id: "c2", slug: "canvass" },
        ],
        [
          { course_id: "c1", slug: "values" },
          { course_id: "c1", slug: "quiz" },
          { course_id: "c2", slug: "field" },
        ]
      ),
      true
    );
  });

  it("stays complete when extra custom courses or modules exist", () => {
    assert.equal(
      catalogCoverageComplete(
        CATALOG,
        [
          { id: "c1", slug: "core" },
          { id: "c2", slug: "canvass" },
          { id: "c3", slug: "hq-extra" },
        ],
        [
          { course_id: "c1", slug: "values" },
          { course_id: "c1", slug: "quiz" },
          { course_id: "c2", slug: "field" },
          { course_id: "c3", slug: "extra-lesson" },
        ]
      ),
      true
    );
  });

  it("is incomplete when a catalog course is missing", () => {
    assert.equal(
      catalogCoverageComplete(
        CATALOG,
        [{ id: "c1", slug: "core" }],
        [
          { course_id: "c1", slug: "values" },
          { course_id: "c1", slug: "quiz" },
        ]
      ),
      false
    );
  });

  it("is incomplete when a catalog module is missing", () => {
    assert.equal(
      catalogCoverageComplete(
        CATALOG,
        [
          { id: "c1", slug: "core" },
          { id: "c2", slug: "canvass" },
        ],
        [
          { course_id: "c1", slug: "values" },
          { course_id: "c2", slug: "field" },
        ]
      ),
      false
    );
  });
});
