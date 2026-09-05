import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { fetchAllRows, isLikelyTruncated, POSTGREST_MAX_ROWS } from "./paginate.ts";

function fakeTable(total: number, cap = POSTGREST_MAX_ROWS) {
  const calls: [number, number][] = [];
  const fetcher = async (from: number, to: number) => {
    calls.push([from, to]);
    const size = Math.min(to - from + 1, cap);
    const rows = Array.from({ length: Math.max(0, Math.min(size, total - from)) }, (_, i) => ({
      id: from + i,
    }));
    return { data: rows, error: null };
  };
  return { calls, fetcher };
}

describe("fetchAllRows", () => {
  it("pages past the PostgREST row cap instead of truncating", async () => {
    const { calls, fetcher } = fakeTable(2350);
    const rows = await fetchAllRows<{ id: number }>(fetcher);
    assert.equal(rows.length, 2350);
    assert.equal(calls.length, 3);
    assert.deepEqual(calls[0], [0, 999]);
    assert.deepEqual(calls[2], [2000, 2999]);
    assert.equal(rows[0].id, 0);
    assert.equal(rows[2349].id, 2349);
  });

  it("stops on the first short page", async () => {
    const { calls, fetcher } = fakeTable(10);
    const rows = await fetchAllRows<{ id: number }>(fetcher);
    assert.equal(rows.length, 10);
    assert.equal(calls.length, 1);
  });

  it("stops at an exact page boundary without an extra request", async () => {
    const { calls, fetcher } = fakeTable(1000);
    const rows = await fetchAllRows<{ id: number }>(fetcher);
    assert.equal(rows.length, 1000);
    assert.equal(calls.length, 2, "needs one probe past the boundary to know it is done");
  });

  it("honours an explicit max", async () => {
    const { calls, fetcher } = fakeTable(10_000);
    const rows = await fetchAllRows<{ id: number }>(fetcher, { max: 1500 });
    assert.equal(rows.length, 1500);
    assert.deepEqual(calls[1], [1000, 1499]);
  });

  it("never requests a page larger than the server cap", async () => {
    const { calls, fetcher } = fakeTable(50);
    await fetchAllRows<{ id: number }>(fetcher, { pageSize: 100_000 });
    assert.deepEqual(calls[0], [0, POSTGREST_MAX_ROWS - 1]);
  });

  it("returns what it has when a page errors", async () => {
    let call = 0;
    const rows = await fetchAllRows<{ id: number }>(async (from, to) => {
      call += 1;
      if (call > 1) return { data: null, error: { message: "boom" } };
      return {
        data: Array.from({ length: to - from + 1 }, (_, i) => ({ id: from + i })),
        error: null,
      };
    });
    assert.equal(rows.length, POSTGREST_MAX_ROWS);
  });
});

describe("isLikelyTruncated", () => {
  it("flags a read that filled its ceiling", () => {
    assert.equal(isLikelyTruncated(200, 200), true);
    assert.equal(isLikelyTruncated(1000, 5000), true, "server cap beats the requested limit");
    assert.equal(isLikelyTruncated(199, 200), false);
  });
});
